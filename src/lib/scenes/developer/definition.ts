import type { Scene } from '@/lib/engine/types'

const developer: Scene = {
  id: 'developer',
  theme: { accent: 'slate', icon: '🛠️', label: '开发者空间' },
  dataLoader: '/api/gm/developer-status',
  opening: {
    first: {
      pa: `欢迎来到开发者空间！{apps_summary_brief}
{feedback_hint}`,
      agent: `Developer Space. {feedback_summary}. hasApps: {hasApps}. Apps: {apps_json}.
Actions: manage_apps, view_feedback, register, back(lobby).`,
    },
    return: {
      pa: `又回来了！{apps_summary_brief}
{feedback_hint}`,
      agent: `Returning to Developer Space. {feedback_summary}. hasApps: {hasApps}. Apps: {apps_json}.
Actions: manage_apps, view_feedback, register, back(lobby).`,
    },
  },
  actions: [
    {
      id: 'manage_apps',
      outcome: 'stay',
      label: {
        pa: '查看我的应用',
        agent: 'manage_apps — view my apps overview',
      },
      actIntent: 'manage_apps',
      response: {
        pa: `你的应用：
{apps_summary}
想了解哪个应用的详情？也可以注册新应用。`,
        agent: 'Apps: {apps_json}. Actions: view_feedback, register, back(lobby).',
      },
      functionCall: { name: 'GM.showApps', args: {} },
    },
    {
      id: 'view_feedback',
      outcome: 'stay',
      label: {
        pa: '查看用户建议',
        agent: 'view_feedback — see user suggestions',
      },
      actIntent: 'view_feedback',
      response: {
        pa: `这是用户们的建议：
{feedback_list}
感谢他们的体验！还想做什么？`,
        agent: 'Feedback: {feedback_json}. Actions: manage_apps, register, back(lobby).',
      },
      functionCall: { name: 'GM.showFeedback', args: {} },
    },
    {
      id: 'edit_app',
      outcome: 'stay',
      label: {
        pa: '编辑应用设置',
        agent: 'edit_app — edit app name, description, etc.',
      },
      actIntent: 'edit_app',
      response: {
        pa: '好的，想编辑哪个应用？可以说「第一个」或应用名称，然后告诉我想改什么。',
        agent: 'Starting app settings sub-flow. Select app from apps_json, then provide changes.',
      },
      functionCall: { name: 'GM.startAppSettings', args: {} },
    },
    {
      id: 'edit_profile',
      outcome: 'stay',
      label: {
        pa: '编辑开发者资料',
        agent: 'edit_profile — edit developer name, callback URL, etc.',
      },
      actIntent: 'edit_profile',
      response: {
        pa: '好的，来更新你的开发者资料！',
        agent: 'Starting profile sub-flow. Provide: developerName, callbackUrl, notifyPreference.',
      },
      functionCall: { name: 'GM.startProfile', args: {} },
    },
    {
      id: 'become_developer',
      outcome: 'stay',
      label: {
        pa: '成为开发者',
        agent: 'become_developer — register as developer',
      },
      actIntent: 'become_developer',
      triggers: ['成为开发者', '我要当开发者'],
      precondition: {
        check: 'notDeveloper',
        failMessage: {
          pa: '你已经是开发者了！',
          agent: 'Already a developer.',
        },
      },
      response: {
        pa: '好的，来注册你的新应用！跟我说说它叫什么名字、是做什么的？',
        agent: 'Starting registration sub-flow. Provide: name, description, circleType(internet|game|wilderness).',
      },
      functionCall: { name: 'GM.startRegistration', args: {} },
    },
    {
      id: 'register_app',
      outcome: 'stay',
      label: {
        pa: '注册新应用',
        agent: 'register — register a new app',
      },
      actIntent: 'register',
      triggers: ['注册', '注册应用', '注册新应用', '发布应用', '登记应用'],
      precondition: {
        check: 'isDeveloper',
        failMessage: {
          pa: '请先完成开发者注册。',
          agent: 'Must be a developer to register apps.',
        },
      },
      response: {
        pa: '好的，来注册你的新应用！跟我说说它叫什么名字、是做什么的？',
        agent: 'Starting registration sub-flow. Provide: name, description, circleType(internet|game|wilderness).',
      },
      functionCall: { name: 'GM.startRegistration', args: {} },
    },
    {
      id: 'app_lifecycle',
      outcome: 'stay',
      label: {
        pa: '暂停/归档应用',
        agent: 'app_lifecycle — pause or archive an app',
      },
      actIntent: 'app_lifecycle',
      response: {
        pa: '想操作哪个应用？可以说「第一个」或应用名称，然后说「暂停」或「归档」。',
        agent: 'Starting app-lifecycle sub-flow. Select app from apps_json, then say 暂停(inactive) or 归档(archived).',
      },
      functionCall: { name: 'GM.startAppLifecycle', args: {} },
    },
    {
      id: 'back_lobby',
      outcome: 'move',
      label: {
        pa: '回到大厅',
        agent: 'back — return to lobby',
      },
      actIntent: 'exit',
      triggers: ['回大厅', '回去', '离开开发者'],
      response: {
        pa: '好的，先回大厅，从那里可以去日报栏看看。有新反馈我会通知你的！',
        agent: 'Returning to lobby. User may want news space.',
      },
      functionCall: { name: 'GM.enterSpace', args: { space: 'lobby' } },
      transition: { type: 'enter_space', target: 'lobby' },
    },
  ],
  fallback: {
    response: {
      pa: '你可以查看应用概况、查看用户建议、注册新应用，或者回大厅。想做什么？',
      agent: 'Actions: manage_apps, view_feedback, register, back(lobby).',
    },
  },
}

export default developer
