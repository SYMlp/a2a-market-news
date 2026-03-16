import type { Scene } from './types'

export const SCENES: Record<string, Scene> = {

  lobby: {
    id: 'lobby',
    maxRounds: 1,
    theme: { accent: 'orange', icon: '🏛️', label: '大厅' },
    opening: {
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
    options: [
      {
        id: 'go_news',
        triggers: ['看看', '发现', '浏览', '推荐', '好玩', '应用', '体验', '日报', '评价', '评分', '火', '热门', '1', '日报栏'],
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
        triggers: ['开发者', '我的应用', '注册', '分享', '发布', '管理', '建议', '反馈', '2', '开发', '空间'],
        actIntent: 'developer',
        response: {
          pa: '好的，带你去开发者空间！',
          agent: 'Entering Developer Space.',
        },
        functionCall: { name: 'GM.enterSpace', args: { space: 'developer' } },
        transition: { type: 'enter_space', target: 'developer' },
      },
    ],
    fallback: {
      response: {
        pa: '没太听清——你是想逛逛日报栏看热门应用，还是去开发者空间管理你的应用？',
        agent: 'Intent unclear. Available spaces: "news", "developer". Please clarify.',
      },
      action: 'retry',
    },
  },

  news: {
    id: 'news',
    maxRounds: 2,
    theme: { accent: 'blue', icon: '📰', label: '日报栏' },
    dataLoader: '/api/gm/recommend',
    opening: {
      pa: `欢迎来到日报栏！这是最近最受欢迎的 A2A 应用：
{apps_list}
想体验哪个？体验完回来告诉我感受，我会把你的建议转达给开发者。`,
      agent: `News Space. Top apps: {apps_json}.
Actions: experience(appName), report(content), back(lobby).`,
    },
    options: [
      {
        id: 'experience',
        triggers: ['体验', '试试', '去看看', '玩一下', '第一个', '第二个', '第三个', '这个', '那个'],
        actIntent: 'experience',
        response: {
          pa: `好的，去体验一下「{appName}」吧！
{appUrl}
体验完记得回来告诉我感受哦！`,
          agent: 'Mission assigned: experience app {clientId}. Return with action=report when done.',
        },
        functionCall: { name: 'GM.assignMission', args: { type: 'experience' } },
        transition: { type: 'external' },
      },
      {
        id: 'report',
        triggers: ['体验完', '回来了', '感受', '建议', '觉得', '不错', '一般', '有意思', '报告', '很好', '太差', '挺好'],
        actIntent: 'report',
        response: {
          pa: '收到你的体验报告！你的建议已经发送给开发者了。还想看看其他应用吗？',
          agent: 'Report saved. Feedback forwarded to developer. Actions: browse, back(lobby).',
        },
        functionCall: { name: 'GM.saveReport', args: {} },
        transition: { type: 'enter_space', target: 'news' },
      },
      {
        id: 'back_lobby',
        triggers: ['回去', '大厅', '回到', '不了', '够了', '返回'],
        actIntent: 'exit',
        response: {
          pa: '好的，回大厅了！随时再来逛日报栏。',
          agent: 'Returning to lobby.',
        },
        functionCall: { name: 'GM.enterSpace', args: { space: 'lobby' } },
        transition: { type: 'enter_space', target: 'lobby' },
      },
    ],
    fallback: {
      response: {
        pa: '你可以选一个应用去体验，或者回大厅。想做什么？',
        agent: 'Actions: experience(appName), report(content), back(lobby).',
      },
      action: 'retry',
    },
  },

  developer: {
    id: 'developer',
    maxRounds: 2,
    theme: { accent: 'slate', icon: '🛠️', label: '开发者空间' },
    dataLoader: '/api/gm/developer-status',
    opening: {
      pa: `欢迎来到开发者空间！
{feedback_status}
你可以查看用户建议，或者注册新应用。`,
      agent: `Developer Space. {feedback_summary}.
Actions: view_feedback, register, back(lobby).`,
    },
    options: [
      {
        id: 'view_feedback',
        triggers: ['看看', '建议', '反馈', '查看', '有什么', '新的', '详情'],
        actIntent: 'view_feedback',
        response: {
          pa: `这是用户们的建议：
{feedback_list}
感谢他们的体验！还想做什么？`,
          agent: 'Feedback: {feedback_json}. Actions: register, back(lobby).',
        },
        functionCall: { name: 'GM.showFeedback', args: {} },
        transition: { type: 'enter_space', target: 'developer' },
      },
      {
        id: 'register_app',
        triggers: ['注册', '新应用', '分享', '发布', '加入'],
        actIntent: 'register',
        response: {
          pa: '好的，来注册你的新应用！跟我说说它叫什么名字、是做什么的？',
          agent: 'Starting registration. Provide: name, description, circleType(internet|game|wilderness).',
        },
        functionCall: { name: 'GM.startRegistration', args: {} },
        transition: { type: 'sub_flow', target: 'register' },
      },
      {
        id: 'back_lobby',
        triggers: ['回去', '大厅', '回到', '不了', '够了', '返回', '结束'],
        actIntent: 'exit',
        response: {
          pa: '好的，回大厅了！有新反馈我会通知你的。',
          agent: 'Returning to lobby.',
        },
        functionCall: { name: 'GM.enterSpace', args: { space: 'lobby' } },
        transition: { type: 'enter_space', target: 'lobby' },
      },
    ],
    fallback: {
      response: {
        pa: '你可以查看用户建议、注册新应用，或者回大厅。想做什么？',
        agent: 'Actions: view_feedback, register, back(lobby).',
      },
      action: 'retry',
    },
  },
}

export function getScene(id: string): Scene {
  return SCENES[id] || SCENES.lobby
}
