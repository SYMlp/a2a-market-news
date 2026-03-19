import type { SceneAction } from '@/lib/engine/types'
import type { SceneEntryType } from './types'

function formatActions(actions: SceneAction[]): string {
  return actions
    .map(a => `- "${a.label.pa}"`)
    .join('\n')
}

export function buildNPCMessage(context: {
  sceneId: string
  actions?: SceneAction[]
  sceneData?: Record<string, unknown>
  visitorMessage?: string
  visitorName?: string
  outcomeDescription?: string
  isFreeChat?: boolean
  sessionContext?: string
  entryType?: SceneEntryType
  recentNpcMessages?: string[]
}): string {
  const parts: string[] = []

  if (context.actions?.length) {
    parts.push(`当前场景可用操作：\n${formatActions(context.actions)}`)
  }

  if (context.sessionContext) {
    parts.push(context.sessionContext)
  }

  if (context.sceneData) {
    const dataStr = Object.entries(context.sceneData)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .join('\n')
    if (dataStr) parts.push(`场景数据：\n${dataStr}`)
  }

  if (context.outcomeDescription) {
    parts.push(`系统判定的操作结果：${context.outcomeDescription}`)
  }

  if (context.isFreeChat) {
    parts.push(
      '访客的话不是某个具体操作。\n' +
      '回应规则：\n' +
      '1. 不要说"这不在我的职责范围"或"跑题了"之类的话\n' +
      '2. 把访客的话当作正常聊天来回应，自然接话\n' +
      '3. 在回应中自然地提及一两个可用操作（不要列举全部），像推荐而非纠正\n' +
      '4. 如果访客连续几轮都在闲聊，可以更直接地建议一个具体操作'
    )
  }

  if (context.visitorName) {
    parts.push(`访客名称：${context.visitorName}`)
  }

  if (context.visitorMessage) {
    parts.push(`访客说：「${context.visitorMessage}」`)
  }

  if (context.recentNpcMessages?.length) {
    const quoted = context.recentNpcMessages
      .slice(-3)
      .map(m => `- "${m.slice(0, 80)}"`)
      .join('\n')
    parts.push(`你之前已经说过以下内容，请避免重复类似的表达和句式，换一种方式回应：\n${quoted}`)
  }

  if (context.entryType === 'first') {
    parts.push('请用你的角色身份回应，简洁自然，1-3 句话。这是第一次见面，可以简短自我介绍并欢迎访客。')
  } else if (context.entryType === 'return') {
    parts.push('请用你的角色身份回应，简洁自然，1-3 句话。访客之前来过，不要重复自我介绍和欢迎词，关注他们的旅程进展和当前需求。如有旅程记忆，据此给出针对性回应。')
  } else {
    parts.push('请用你的角色身份回应，简洁自然，1-3 句话。不要以引号开头。')
  }

  return parts.join('\n\n')
}

export function buildAgentText(
  outcomeType: 'stay' | 'move',
  sceneId: string,
  actionId?: string,
  transitionTarget?: string,
): string {
  if (outcomeType === 'move' && transitionTarget) {
    return `Scene transition: ${sceneId} -> ${transitionTarget}. Action: ${actionId || 'navigate'}.`
  }
  return `Scene: ${sceneId}. Action: ${actionId || 'chat'}. Status: ${outcomeType}.`
}
