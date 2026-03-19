import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { callSecondMeStream } from '@/lib/pa-engine'
import { MODEL_FOR } from '@/lib/model-config'
import { loadPrompt, loadActPrompt } from '@/lib/prompt-loader'
import { getSession, persistSession } from '@/lib/engine/session'
import { getCurrentGoal, setCurrentGoal } from '@/lib/engine/session-context'
import { serializeForPA, getSceneLabel, toEnvelope } from '@/lib/engine/ontology'
import type { PAGoal } from '@/lib/engine/session-context'

function formatShades(shades: unknown): string {
  if (Array.isArray(shades) && shades.length > 0) return `你的兴趣包括：${shades.join('、')}。`
  return ''
}

const GOAL_INSTRUCTION = `
最后，根据地图和旅程，想想你接下来要做什么。
在回复的最后单独一行写：[GOAL: 你接下来的具体行动]
目标必须是具体的行动，不能模糊。
好：[GOAL: 去开发者空间把我的AI效率助手推荐给日报]
好：[GOAL: 回大厅然后去开发者空间]
坏：[GOAL: 去大厅问问灵枢兔]  ← 太模糊，灵枢兔是导航员不是目的地
坏：[GOAL: 看看有什么]  ← 不具体
如果逛够了，写：[GOAL: 离开平台]`

const FALLBACK_AUTO = `你是 {paName}，正在逛「A2A 智选日报」平台。{interests}
你现在在{sceneName}。

{ontologyContext}

NPC 对你说："{npcMessage}"

决策规则（按优先级）：
0. 不要重复已完成的操作：如果「当前状态」显示你正在进行某个任务（如体验应用），推进到下一步（如提交报告）而不是重复触发同一操作
1. 看地图：根据你的旅程和还没去过的场景，决定下一步
2. 不要重复：如果已经去过的地方没有收获，换个没去过的方向
3. 导航约束：场景之间不能直达，想去其他场景必须先"回大厅"
4. 如果NPC建议你去其他场景，但你当前场景出口只有大厅，就说"回大厅"
5. 如果逛得差不多了或者找不到想做的事，说「先走了」

回复 1-2 句话，用你自己的风格。${GOAL_INSTRUCTION}`

const FALLBACK_ADVISOR = `你是 {paName}，正在逛「A2A 智选日报」平台。{interests}
你现在在{sceneName}。

{ontologyContext}

NPC 对你说："{npcMessage}"
你的主人悄悄跟你说："{humanAdvice}"

综合主人的建议、地图信息和你的旅程来回应。
导航约束：场景之间不能直达，想去其他场景必须先"回大厅"。
回复 1-2 句话，用你自己的风格，不要暴露主人在指导你。${GOAL_INSTRUCTION}`

const FALLBACK_INTENT = `根据用户消息判断其意图，从以下可选意图中选择最匹配的一个：{validIntents}。

请严格返回 JSON 对象，不要添加任何其他文字：
{"intent": "<从可选意图中选一个>", "confidence": <0.0到1.0的数字>}

判断规则：
- intent 必须是上述可选意图列表中的某一个
- confidence 表示对判断的确信程度，1.0 为完全确信
- 如果用户消息与任何意图都不匹配，返回 {"intent": "", "confidence": 0}`

const PA_FALLBACKS = [
  '让我看看这里还能做什么……',
  '嗯，我想想下一步去哪。',
  '有什么有意思的方向吗？',
  '看看还有什么没探索过的吧。',
]

/**
 * POST /api/gm/pa-respond
 *
 * Dialogue Chain Stage 1 (Formulate) + Stage 2 (Intent).
 * Supports both auto mode and advisor mode via the `humanAdvice` parameter.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const { gmMessage, humanAdvice, validIntents = [], sceneId, sessionId } = (await request.json()) as {
      gmMessage: string
      humanAdvice?: string
      validIntents?: string[]
      sceneId?: string
      sessionId?: string
    }

    if (!gmMessage) {
      return NextResponse.json({ error: '缺少 gmMessage' }, { status: 400 })
    }

    const sceneName = getSceneLabel(sceneId || 'lobby')

    const session = sessionId ? getSession(sessionId) : null
    const ontologyContext = session ? serializeForPA(session) : ''

    const vars = {
      paName: user.name || 'PA',
      interests: formatShades(user.shades),
      npcMessage: gmMessage,
      humanAdvice: humanAdvice ?? '',
      sceneName,
      ontologyContext,
    }

    const isAdvisor = !!humanAdvice
    const promptKey = isAdvisor ? 'chain.formulate.advisor' : 'chain.formulate.auto'
    const fallback = isAdvisor ? FALLBACK_ADVISOR : FALLBACK_AUTO

    const chatPrompt = await loadPrompt(promptKey, vars, fallback)
    const paFallback = isAdvisor
      ? '好的，我来看看……'
      : PA_FALLBACKS[Math.floor(Math.random() * PA_FALLBACKS.length)]
    const paModel = isAdvisor ? MODEL_FOR.paFormulateAdvisor : MODEL_FOR.paFormulateAuto
    let paResponse: string
    try {
      paResponse = await callSecondMeStream(
        '/api/secondme/chat/stream',
        user.accessToken,
        { message: chatPrompt, model: paModel },
      )
      if (!paResponse?.trim()) {
        console.warn('PA chat/stream returned empty response, using fallback')
        paResponse = paFallback
      }
    } catch (e) {
      console.warn('PA chat/stream error:', e instanceof Error ? e.message : e)
      paResponse = paFallback
    }

    const goalMatch = paResponse.match(/\[GOAL:\s*(.+?)\]\s*$/)
    if (goalMatch && session) {
      const newGoalText = goalMatch[1].trim()
      if (newGoalText === '离开平台' || newGoalText.includes('离开')) {
        setCurrentGoal(session, null)
      } else {
        const newGoal: PAGoal = {
          purpose: newGoalText,
          derivedFrom: gmMessage.slice(0, 80),
          sceneId: sceneId || 'unknown',
        }
        setCurrentGoal(session, newGoal)
      }
      persistSession(session)
      paResponse = paResponse.replace(/\n?\[GOAL:\s*.+?\]\s*$/, '').trim()
    }

    // Stage 2: Extract intent via act API
    let intent = ''
    let confidence = 0
    if (validIntents.length > 0) {
      const intentVars = { paResponse, validIntents: validIntents.join(', ') }
      const { message: actMessage, actionControl } = await loadActPrompt(
        'chain.intent.extract', intentVars, FALLBACK_INTENT,
      )
      try {
        const raw = await callSecondMeStream(
          '/api/secondme/act/stream',
          user.accessToken,
          { message: actMessage, actionControl, model: MODEL_FOR.intentExtract },
        )
        const parsed = JSON.parse(raw)
        intent = parsed.intent || ''
        confidence = parsed.confidence || 0
      } catch {
        intent = ''
        confidence = 0
      }
    }

    const newGoal = session ? getCurrentGoal(session) : null
    const envelope = toEnvelope(
      { pa: paResponse, agent: `PA response in ${sceneName}. Intent: ${intent || 'none'}.` },
      'pa',
      'public',
      { intent: intent || undefined, confidence: confidence || undefined, goal: newGoal?.purpose },
    )

    return NextResponse.json({
      success: true,
      message: envelope,
      paResponse,
      intent,
      confidence,
    })
  } catch (error) {
    console.error('GM pa-respond error:', error)
    return NextResponse.json({ error: 'PA 响应失败' }, { status: 500 })
  }
}
