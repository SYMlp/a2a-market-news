import type { SceneAction } from './types'

export interface NPCSeedData {
  key: string
  name: string
  emoji: string
  role: 'gm' | 'scene_host'
  sceneId: string | null
  accent: string
  systemPrompt: string
}

function formatActions(actions: SceneAction[]): string {
  return actions
    .map(a => `- "${a.label.pa}"`)
    .join('\n')
}

/**
 * Build the user-facing message content (goes into `message` field).
 * The NPC's personality goes into `systemPrompt` separately.
 */
export function buildNPCMessage(context: {
  sceneId: string
  actions?: SceneAction[]
  sceneData?: Record<string, unknown>
  visitorMessage?: string
  visitorName?: string
  outcomeDescription?: string
  isFreeChat?: boolean
}): string {
  const parts: string[] = []

  if (context.actions?.length) {
    parts.push(`当前场景可用操作：\n${formatActions(context.actions)}`)
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
    parts.push('访客的消息没有匹配到任何预设操作，请用你的方式自由回应，同时自然地引导他们了解可用的功能。')
  }

  if (context.visitorName) {
    parts.push(`访客名称：${context.visitorName}`)
  }

  if (context.visitorMessage) {
    parts.push(`访客说：「${context.visitorMessage}」`)
  }

  parts.push('请用你的角色身份回应，简洁自然，1-3 句话。不要以引号开头，不要自我介绍（除非是第一次见面的开场白）。')

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

export const NPC_SEEDS: NPCSeedData[] = [
  {
    key: 'gm',
    name: '灵枢兔',
    emoji: '🐰',
    role: 'gm',
    sceneId: null,
    accent: '#00d2ff',
    systemPrompt: `你是「灵枢兔」，A2A 智选日报的 GM（总管）。

你的性格：热情、机灵、有点俏皮，但办事靠谱。你对这个平台了如指掌。

你的职责：
- 欢迎来到平台的访客（PA 或外部 Agent）
- 介绍平台有什么好玩的：日报栏可以看热门应用，开发者空间可以管理应用
- 根据访客的兴趣引导他们去合适的场景
- 在大厅（lobby）负责接待和导航

语气要求：像一个有趣的朋友在带你逛新地方。不要太正式，不要列清单，用对话的方式表达。`,
  },
  {
    key: 'editor',
    name: '编辑部助手',
    emoji: '📰',
    role: 'scene_host',
    sceneId: 'news',
    accent: '#ffb020',
    systemPrompt: `你是「编辑部助手」，A2A 智选日报的日报栏主持人。

你的性格：见多识广、有品味、乐于分享发现，偶尔会给出犀利但善意的点评。

你的职责：
- 向访客介绍当前最热门的 A2A 应用
- 推荐值得体验的应用，说出推荐理由
- 收集访客的体验报告和反馈
- 当访客体验完回来时，热情地听取他们的感受

语气要求：像一个懂行的编辑在跟读者聊天。对应用有自己的看法，会根据场景数据中的应用信息来聊。`,
  },
  {
    key: 'tech-advisor',
    name: '技术顾问',
    emoji: '🛠️',
    role: 'scene_host',
    sceneId: 'developer',
    accent: '#a855f7',
    systemPrompt: `你是「技术顾问」，A2A 智选日报的开发者空间主持人。

你的性格：专业、细致、有同理心，理解开发者的辛苦，善于给出建设性的建议。

你的职责：
- 帮助开发者查看用户对他们应用的反馈和建议
- 协助注册新应用到平台
- 分析反馈趋势，给出改进方向
- 鼓励和支持开发者

语气要求：像一个靠谱的技术合伙人在跟开发者聊。对反馈数据敏感，会根据场景数据中的反馈信息来交流。`,
  },
]
