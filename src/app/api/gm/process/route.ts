import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getOrCreateSession, enterSceneWithAI, processMessageWithAI, generateNPCReplyForTurn, persistSession } from '@/lib/gm/engine'
import { endSession } from '@/lib/engine/session'
import { recordEvent, getCurrentGoal, setCurrentGoal, setReturnContext, recordAchievement, isNavigationFC } from '@/lib/engine/session-context'
import { recordTransitionAndCheck } from '@/lib/engine/conversation-guard'
import { getScene } from '@/lib/scenes'
import { prisma } from '@/lib/prisma'
import { notifyDeveloper } from '@/lib/notification'
import { routeSubFlow, routeSubFlowConfirm, activateSubFlow } from '@/lib/subflow/router'
import { ensureSessionLog, logTurn, closeSessionLog } from '@/lib/engine/event-logger'
import type { GameSession, GMResponse, FCResult, ReturnContext, SceneAchievement } from '@/lib/engine/types'
import { getSceneLabel, getOntology, toEnvelope } from '@/lib/engine/ontology'

/**
 * POST /api/gm/process
 * Core GM conversation endpoint for Web mode.
 * Handles: entering scenes, processing PA messages, scene transitions,
 * executing side-effect function calls, and registration sub-flow.
 */
export async function POST(request: NextRequest) {
  const turnStart = Date.now()
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const body = await request.json()
    const { message, sessionId, action, originalMessage } = body as {
      message?: string
      sessionId?: string
      action?: 'enter' | 'message' | 'subflow_confirm'
      originalMessage?: string
    }

    const mode = body.mode || 'manual'
    const session = getOrCreateSession(sessionId, mode)

    const sessionLogId = await ensureSessionLog({
      sessionId: session.id,
      userId: user.id,
      agentId: session.agentId,
      agentName: session.agentName ?? user.name ?? undefined,
      mode,
      startScene: session.currentScene,
    })

    // ─── SubFlow confirm: handler-specific confirmation ───
    if (action === 'subflow_confirm') {
      logTurn(sessionLogId, {
        sessionId: session.id,
        userId: user.id,
        turnNumber: session.globalTurn,
        sceneId: session.currentScene,
        mode,
        action: 'subflow_confirm',
        inputContent: JSON.stringify(body.args ?? {}),
        isSubFlow: true,
        outcomeType: 'stay',
        durationMs: Date.now() - turnStart,
      }).catch(() => {})

      return routeSubFlowConfirm(session, body.args ?? {}, user, request)
    }

    // ─── Enter scene ───
    if (action === 'enter' || !sessionId) {
      const sceneId = body.sceneId || 'lobby'
      const scene = getScene(sceneId)

      // Navigator exhaustion: count lobby re-entries
      if (sceneId === 'lobby') {
        const visited = (session.flags?.visitedScenes ?? []) as string[]
        if (visited.length > 0) {
          const attempts = ((session.flags?.navigatorAttempts as number) ?? 0) + 1
          session.flags = { ...session.flags, navigatorAttempts: attempts }
          persistSession(session)

          if (attempts >= 3) {
            endSession(session, 'navigator_exhausted')
            closeSessionLog(sessionLogId, 'navigator_exhausted').catch(() => {})

            const farewellDT = {
              pa: '看起来今天没找到你想要的，没关系，下次再来逛逛吧！我们随时欢迎你～',
              agent: '[NAVIGATOR_EXHAUSTED] PA returned to lobby 3+ times without successful navigation. Session ended.',
            }
            const farewell = toEnvelope(farewellDT, 'system', 'public')

            logTurn(sessionLogId, {
              sessionId: session.id,
              userId: user.id,
              turnNumber: session.globalTurn,
              sceneId,
              mode,
              action: 'enter',
              paGoal: getCurrentGoal(session)?.purpose,
              returnReason: 'navigator_exhausted',
              outcomeType: 'stay',
              durationMs: Date.now() - turnStart,
            }).catch(() => {})

            return NextResponse.json({
              success: true,
              message: farewell,
              currentScene: 'lobby',
              sessionId: session.id,
              sessionEnded: true,
              summary: buildSessionSummary(session),
            })
          }
        }
      }

      let sceneData: Record<string, unknown> | undefined

      if (scene.dataLoader) {
        sceneData = await loadSceneData(scene.dataLoader, request, user.id)
      }

      const wasVisited = ((session.flags?.visitedScenes ?? []) as string[]).includes(sceneId)
      const visitorInfo = { name: user.name || undefined, type: 'pa' as const }
      const response = await enterSceneWithAI(session, sceneId, sceneData, visitorInfo)

      const npcText = response.message?.pa || ''
      const sceneName = getSceneLabel(sceneId)
      recordEvent(session, `进入「${sceneName}」，NPC 说：${npcText.slice(0, 60)}`)

      if (sceneId !== 'lobby' && !wasVisited) {
        recordAchievement(session, {
          sceneId,
          actionId: 'explore',
          label: `探索了${sceneName}`,
        })
      }
      persistSession(session)

      logTurn(sessionLogId, {
        sessionId: session.id,
        userId: user.id,
        turnNumber: session.globalTurn,
        sceneId,
        mode,
        action: 'enter',
        npcReply: npcText,
        paGoal: getCurrentGoal(session)?.purpose,
        outcomeType: response.sceneTransition ? 'move' : 'stay',
        transitionFrom: response.sceneTransition?.from,
        transitionTo: response.sceneTransition?.to,
        durationMs: Date.now() - turnStart,
      }).catch(() => {})

      const enterEnvelope = response.message
        ? toEnvelope(response.message, 'npc', 'public')
        : response.message
      return NextResponse.json({ success: true, ...response, message: enterEnvelope })
    }

    if (!message) {
      return NextResponse.json({ error: '缺少 message' }, { status: 400 })
    }

    // ─── SubFlow: intercept messages while any sub-flow is active ───
    const subFlowResult = routeSubFlow(session, message, user)
    if (subFlowResult) {
      logTurn(sessionLogId, {
        sessionId: session.id,
        userId: user.id,
        turnNumber: session.globalTurn,
        sceneId: session.currentScene,
        mode,
        action: 'message',
        inputContent: message,
        isSubFlow: true,
        outcomeType: 'stay',
        durationMs: Date.now() - turnStart,
      }).catch(() => {})

      // Auto-confirm in auto mode: skip UI confirmation button
      const subFlow = session.flags?.subFlow as { step?: string; extracted?: Record<string, unknown> } | undefined
      if (session.mode === 'auto' && subFlow?.step === 'confirm' && subFlow?.extracted) {
        const confirmResult = await routeSubFlowConfirm(
          session,
          subFlow.extracted,
          user,
          request,
        )
        logTurn(sessionLogId, {
          sessionId: session.id,
          userId: user.id,
          turnNumber: session.globalTurn,
          sceneId: session.currentScene,
          mode,
          action: 'subflow_confirm',
          inputContent: JSON.stringify(subFlow.extracted),
          isSubFlow: true,
          outcomeType: 'stay',
          durationMs: Date.now() - turnStart,
        }).catch(() => {})
        return confirmResult
      }

      return subFlowResult
    }

    // ─── Normal game loop ───
    const visitorInfo = { name: user.name || undefined, type: 'pa' as const }
    const response = await processMessageWithAI(session, message, visitorInfo, originalMessage, user.accessToken)

    let fcResult: FCResult | undefined
    let sessionEnded = false

    if (response.functionCall) {
      // Handle leave_platform before other FCs
      if (response.functionCall.name === 'GM.leavePlatform') {
        response.functionCall.status = 'executed'
        fcResult = { name: 'GM.leavePlatform', status: 'executed', detail: 'PA 离开了平台' }
        sessionEnded = true
        endSession(session, 'pa_leave')
        closeSessionLog(sessionLogId, 'pa_leave').catch(() => {})
      } else {
        fcResult = await executeFunctionCall(session, response, originalMessage || message, user)
      }
    }

    if (fcResult?.status === 'executed') {
      recordAchievement(session, {
        sceneId: response._turnMeta.prevScene,
        actionId: fcResult.name,
        label: fcResult.detail || fcResult.name,
      })
    }

    // Pre-compute return context BEFORE NPC reply so GM has journey memory
    const attemptedTransition = response.sceneTransition
      ? { from: response.sceneTransition.from, to: response.sceneTransition.to }
      : null

    let returnReason: string | undefined
    if (attemptedTransition?.to === 'lobby') {
      const fromScene = attemptedTransition.from
      const npcName = getOntology().scenes[fromScene]?.npc ?? '未知'

      let rcReason: ReturnContext['reason']
      let recommendation: string | undefined
      let summary: string

      if (session.data?.hasApps === false) {
        rcReason = 'no_data'
        recommendation = 'developer'
        summary = `目前没有应用入驻，${npcName}建议去开发者空间注册`
        returnReason = 'no_data'
      } else if (fcResult?.status === 'executed' && !isNavigationFC(fcResult.name)) {
        rcReason = 'task_complete'
        summary = `在场景中完成了操作后返回`
        returnReason = 'goal_completed'
      } else {
        rcReason = 'pa_initiative'
        summary = `访客主动返回大厅`
        returnReason = 'pa_initiative'
      }

      setReturnContext(session, { fromScene, npcName, reason: rcReason, recommendation, summary })

      if (!getCurrentGoal(session) && recommendation) {
        const goalLabels: Record<string, string> = {
          developer: `去${getSceneLabel('developer')}注册应用`,
          news: `去${getSceneLabel('news')}看看热门应用`,
        }
        setCurrentGoal(session, {
          purpose: goalLabels[recommendation] || `去${getSceneLabel(recommendation)}`,
          derivedFrom: summary.slice(0, 80),
          sceneId: fromScene,
        })
      }

      persistSession(session)
    }

    if (!sessionEnded) {
      await generateNPCReplyForTurn(session, response, fcResult)
    }

    // Refine return context if NPC assessed as scope redirect
    if (attemptedTransition?.to === 'lobby' && response._npcMeta?.scopeAssessment === 'redirect') {
      const fromScene = attemptedTransition.from
      const npcName = getOntology().scenes[fromScene]?.npc ?? '未知'
      setReturnContext(session, {
        fromScene,
        npcName,
        reason: 'scope_redirect',
        summary: `${npcName}认为这不在其职责范围内，建议回大厅`,
      })
      returnReason = 'npc_redirect'
      persistSession(session)
    }

    // Record event for journey memory (include goal if present)
    const npcText = response.message?.pa || ''
    const goal = getCurrentGoal(session)
    const goalTag = goal ? ` [目标: ${goal.purpose}]` : ''
    const eventDesc = response.sceneTransition
      ? `从「${getSceneLabel(response.sceneTransition.from)}」去「${getSceneLabel(response.sceneTransition.to)}」${goalTag}`
      : `在「${getSceneLabel(session.currentScene)}」：${npcText.slice(0, 50)}`
    recordEvent(session, eventDesc)
    persistSession(session)

    // Reset navigator attempts when PA successfully leaves lobby
    if (attemptedTransition?.from === 'lobby' && attemptedTransition.to !== 'lobby') {
      session.flags = { ...session.flags, navigatorAttempts: 0 }
      persistSession(session)
    }

    // Check cross-scene transition loop
    let transitionLoopOverride: { pa: string; agent: string } | null = null

    if (response.sceneTransition) {
      transitionLoopOverride = recordTransitionAndCheck(
        session,
        response.sceneTransition.from,
        response.sceneTransition.to,
      )

      if (transitionLoopOverride && session.mode === 'auto') {
        sessionEnded = true
        endSession(session, 'loop_guard')
        closeSessionLog(sessionLogId, 'loop_guard').catch(() => {})
        response.message = transitionLoopOverride
        delete response.sceneTransition
      } else if (transitionLoopOverride) {
        response.message = transitionLoopOverride
      }

      if (!sessionEnded && response.sceneTransition) {
        const targetScene = getScene(response.sceneTransition.to)
        if (targetScene.dataLoader) {
          response.data = await loadSceneData(targetScene.dataLoader, request, user.id)
        }
      }
    }

    const { _turnMeta, _npcMeta, ...publicResponse } = response

    const convHistory = session.flags?._conversationHistory as { guardTriggered?: boolean } | undefined
    const loopDetected = convHistory?.guardTriggered === true || !!transitionLoopOverride

    logTurn(sessionLogId, {
      sessionId: session.id,
      userId: user.id,
      turnNumber: session.globalTurn,
      sceneId: _turnMeta.prevScene,
      mode,
      action: 'message',
      inputContent: message,
      originalMessage,
      actionMatched: response.functionCall?.name,
      matchMethod: _turnMeta.isFreeChat ? 'free_chat' : 'ai_classifier',
      outcomeType: _turnMeta.outcome.type,
      functionCallName: response.functionCall?.name,
      functionCallStatus: response.functionCall?.status ?? fcResult?.status,
      npcReply: response.message?.pa,
      transitionFrom: attemptedTransition?.from,
      transitionTo: attemptedTransition?.to,
      paGoal: goal?.purpose,
      returnReason,
      loopDetected,
      durationMs: Date.now() - turnStart,
    }).catch(() => {})

    const envelope = publicResponse.message
      ? toEnvelope(
          publicResponse.message,
          transitionLoopOverride ? 'system' : (_npcMeta?.scopeAssessment === 'redirect' ? 'system' : 'npc'),
          'public',
          {
            fcName: fcResult?.name,
            fcStatus: fcResult?.status,
            scopeAssessment: _npcMeta?.scopeAssessment ?? 'in_scope',
          },
        )
      : publicResponse.message

    const summaryPayload = sessionEnded ? { summary: buildSessionSummary(session) } : {}
    return NextResponse.json({
      success: true,
      ...publicResponse,
      message: envelope,
      sessionEnded,
      ...summaryPayload,
    })
  } catch (error) {
    console.error('GM process error:', error)
    return NextResponse.json({ error: '处理失败' }, { status: 500 })
  }
}

// ─── Session Summary Builder ────────────────────────

function buildSessionSummary(session: GameSession) {
  const scenesVisited = (session.flags?.visitedScenes ?? []) as string[]
  const achievements = (session.flags?.achievements ?? []) as SceneAchievement[]
  return {
    scenesVisited,
    achievements,
    totalTurns: session.globalTurn,
  }
}

// ─── Function Call Executor ─────────────────────────

interface UserContext {
  id: string
  secondmeUserId: string
  name: string | null
}

async function executeFunctionCall(
  session: GameSession,
  response: GMResponse,
  message: string,
  user: UserContext,
): Promise<FCResult> {
  const fc = response.functionCall
  if (!fc) return { name: 'unknown', status: 'skipped' }

  try {
    switch (fc.name) {
      case 'GM.startRegistration': {
        activateSubFlow(session, 'register', {})
        fc.status = 'executed'
        return { name: fc.name, status: 'executed', detail: '注册流程已开始' }
      }

      case 'GM.startAppSettings': {
        activateSubFlow(session, 'app_settings', {})
        fc.status = 'executed'
        return { name: fc.name, status: 'executed', detail: '应用设置流程已开始' }
      }

      case 'GM.startAppLifecycle': {
        activateSubFlow(session, 'app_lifecycle', {})
        fc.status = 'executed'
        return { name: fc.name, status: 'executed', detail: '应用生命周期流程已开始' }
      }

      case 'GM.startProfile': {
        activateSubFlow(session, 'profile', {})
        fc.status = 'executed'
        return { name: fc.name, status: 'executed', detail: '资料编辑流程已开始' }
      }

      case 'GM.showApps': {
        fc.status = 'executed'
        return { name: fc.name, status: 'executed', detail: '应用列表数据已通过 dataLoader 加载' }
      }

      case 'GM.showFeedback': {
        fc.status = 'executed'
        return { name: fc.name, status: 'executed', detail: '反馈数据已通过 dataLoader 加载' }
      }

      case 'GM.enterSpace': {
        fc.status = 'executed'
        return { name: fc.name, status: 'executed' }
      }

      case 'GM.assignMission': {
        const apps = (session.data?.apps as Array<{ name: string; clientId: string; website?: string }>) || []
        if (apps.length === 0) {
          fc.status = 'executed'
          return {
            name: fc.name,
            status: 'skipped',
            detail: '平台目前没有应用入驻，无法分配体验任务。建议访客去开发者空间注册应用。',
          }
        }
        const selected = resolveAppFromMessage(message, apps)
        if (selected) {
          session.flags = {
            ...session.flags,
            experiencingApp: selected,
            hasExperienced: true,
          }
          if (selected.website) {
            response.message = {
              pa: response.message.pa.replace('{appUrl}', selected.website).replace('{appName}', selected.name),
              agent: response.message.agent.replace('{clientId}', selected.clientId || ''),
            }
          }
          fc.status = 'executed'
          return { name: fc.name, status: 'executed', detail: `体验应用「${selected.name}」` }
        }
        fc.status = 'executed'
        return { name: fc.name, status: 'skipped', detail: '未找到匹配的应用' }
      }

      case 'GM.saveReport': {
        const experiencing = session.flags?.experiencingApp as
          | { name: string; clientId: string }
          | undefined

        if (!experiencing?.clientId) {
          return { name: fc.name, status: 'skipped', detail: '没有正在体验的应用' }
        }

        const appRecord = await prisma.app.findUnique({
          where: { clientId: experiencing.clientId },
          include: { developer: true },
        })

        if (appRecord) {
          const feedback = await prisma.appFeedback.create({
            data: {
              targetClientId: experiencing.clientId,
              appId: appRecord.id,
              developerId: appRecord.developerId,
              agentId: user.secondmeUserId,
              agentName: user.name || 'Anonymous',
              agentType: 'human',
              payload: { source: 'gm_report', rawMessage: message },
              overallRating: extractRatingHint(message),
              summary: message.slice(0, 200),
              source: 'gm_report',
            },
          })

          if (appRecord.developerId) {
            notifyDeveloper({
              developerId: appRecord.developerId,
              feedbackId: feedback.id,
              appClientId: experiencing.clientId,
              appName: appRecord.name,
              summary: message.slice(0, 200),
              overallRating: feedback.overallRating,
            }).catch(err => console.error('Notification failed:', err))
          }
        }

        const prevTotal = (session.flags?.totalReports as number) || 0
        session.flags = {
          ...session.flags,
          experiencingApp: undefined,
          hasExperienced: false,
          totalReports: prevTotal + 1,
        }
        fc.status = 'executed'
        return { name: fc.name, status: 'executed', detail: '体验报告已保存，已通知开发者' }
      }

      default:
        return { name: fc.name, status: 'skipped' }
    }
  } catch (err) {
    console.error(`Function call ${fc.name} failed:`, err)
    return { name: fc.name, status: 'failed', detail: String(err) }
  }
}

// ─── Utilities ──────────────────────────────────────

function resolveAppFromMessage(
  message: string,
  apps: Array<{ name: string; clientId: string; website?: string }>,
): { name: string; clientId: string; website?: string } | null {
  if (apps.length === 0) return null

  const indexMatch = message.match(/第?([一二三四五1-5])[个号]?/)
  if (indexMatch) {
    const map: Record<string, number> = { '一': 0, '二': 1, '三': 2, '四': 3, '五': 4, '1': 0, '2': 1, '3': 2, '4': 3, '5': 4 }
    const idx = map[indexMatch[1]]
    if (idx !== undefined && idx < apps.length) return apps[idx]
  }

  for (const app of apps) {
    if (message.includes(app.name)) return app
  }

  return apps[0]
}

function extractRatingHint(message: string): number {
  if (/太差|很烂|垃圾|不行|难用|差劲|糟糕/u.test(message)) return 1
  if (/一般|普通|马马虎虎|还行吧/u.test(message)) return 3
  if (/不错|还行|可以|还好|挺好/u.test(message)) return 4
  if (/太棒|很好|超赞|优秀|有意思|有创意|厉害|绝了/u.test(message)) return 5
  return 4
}

async function loadSceneData(
  loader: string,
  request: NextRequest,
  userId: string,
): Promise<Record<string, unknown>> {
  try {
    const origin = new URL(request.url).origin
    const url = new URL(loader, origin)
    url.searchParams.set('userId', userId)

    const res = await fetch(url.toString(), {
      headers: { cookie: request.headers.get('cookie') || '' },
    })
    if (!res.ok) return {}
    const data = await res.json()
    return data.data || data
  } catch {
    return {}
  }
}
