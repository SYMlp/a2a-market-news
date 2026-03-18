import type { Scene } from '@/lib/engine/types'

const lobby: Scene = {
  id: 'lobby',
  theme: { accent: 'orange', icon: '🏛️', label: '大厅' },
  opening: {
    first: {
      pa: `欢迎来到 A2A 智选日报！我是 GM 灵枢兔。
我们收录了很多好玩的 A2A 应用，你可以：
1. 📰 去日报栏看看最近最火的应用
2. 🛠️ 进入开发者空间管理你的应用
告诉我你想做什么？`,
      agent: `Welcome to A2A Market News. Available spaces:
1. "news" — Browse top apps, experience them, submit reports
2. "developer" — Manage your apps, view user feedback
Reply with your chosen space.`,
    },
    return: {
      pa: `又回来了！{returnSummary}
{recommendedHint}你想去哪？说目的地就行。`,
      agent: `Back at lobby from {returnFromLabel}. {returnSummary}
{recommendedHint}Available: "news", "developer", "leave".`,
    },
  },
  actions: [
    {
      id: 'go_news',
      outcome: 'move',
      label: {
        pa: '去日报栏看看热门应用',
        agent: 'Enter News Space to browse top apps',
      },
      actIntent: 'discover',
      response: {
        pa: '好的，带你去日报栏看看最近最火的应用！',
        agent: 'Entering News Space.',
      },
      functionCall: { name: 'GM.enterSpace', args: { space: 'news' } },
      transition: { type: 'enter_space', target: 'news' },
    },
    {
      id: 'go_developer',
      outcome: 'move',
      label: {
        pa: '进入开发者空间',
        agent: 'Enter Developer Space to manage apps',
      },
      actIntent: 'developer',
      response: {
        pa: '好的，带你去开发者空间！',
        agent: 'Entering Developer Space.',
      },
      functionCall: { name: 'GM.enterSpace', args: { space: 'developer' } },
      transition: { type: 'enter_space', target: 'developer' },
    },
    {
      id: 'leave_platform',
      outcome: 'stay',
      label: {
        pa: '先走了，下次再来',
        agent: 'Leave the platform and end session',
      },
      actIntent: 'leave',
      response: {
        pa: '好的，下次再来逛！期待再见到你~',
        agent: 'Session ended. PA left the platform.',
      },
      functionCall: { name: 'GM.leavePlatform', args: {} },
    },
  ],
  fallback: {
    response: {
      pa: '没太听清——你是想逛逛日报栏看热门应用，还是去开发者空间管理你的应用？',
      agent: 'Intent unclear. Available spaces: "news", "developer". Please clarify.',
    },
  },
}

export default lobby
