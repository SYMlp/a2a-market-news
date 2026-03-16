# 剧本引擎规格 (Script Engine Spec)

> 架构指导文档：定义 GM 如何引导 PA/Agent 在平台内交互
> 推导来源：meta/derivation/a2a-interaction-paradigm-three-layer-projection-2026-03-16.md

## 核心约束

| 约束 | 值 | 理由 |
|:---|:---|:---|
| 每场景对话节奏 | 1-2 轮后重新展示选项 | GM 不啰嗦，但 PA 可以一直待着 |
| 场景切换方式 | Function Call | 统一执行层 |
| 文本人称 | PA 视角 + Agent 视角 | 双模式呈现 |
| 驻留自由 | PA 可以无限停留在任何场景 | 图中的节点，不是限时房间 |

## 类型定义

```typescript
// ─── 场景 ─────────────────────────────────────────

interface Scene {
  id: string                    // lobby | news | developer
  maxRounds: 1 | 2

  // GM 进入此场景时说的话
  opening: DualText

  // 此场景需要预加载的数据
  dataLoader?: string           // API endpoint to call on enter

  // PA/Agent 可选的操作
  options: SceneOption[]

  // 所有选项都不匹配时的兜底
  fallback: {
    response: DualText          // GM 的兜底回复
    action: 'retry' | 'exit'   // retry=重新提示, exit=回大厅
  }

  // 视觉主题 (Web 模式)
  theme: {
    accent: string              // tailwind color: orange | blue | slate
    icon: string                // emoji
    label: string               // 空间名称
  }
}

// ─── 双人称文本 ───────────────────────────────────

interface DualText {
  pa: string                    // 给人看: 中文、对话语气、第二人称
  agent: string                 // 给 API: 英文、指令式、含参数说明
}

// ─── 场景选项 ─────────────────────────────────────

interface SceneOption {
  id: string                    // discover | experience | report | ...
  triggers: string[]            // 关键词列表 (手动模式匹配)
  actIntent?: string            // act API 意图标签 (自动模式)

  // GM 识别到此选项后的回复
  response: DualText

  // 触发的 Function Call
  functionCall: {
    name: string                // GM.enterSpace | GM.assignMission | ...
    args: Record<string, unknown>
  }

  // 去向
  transition: SceneTransition
}

// ─── 场景切换 ─────────────────────────────────────

interface SceneTransition {
  type: 'enter_space'           // 进入另一个空间
      | 'sub_flow'              // 在当前空间内进入子流程 (如注册)
      | 'external'              // 外部链接 (去体验应用)
      | 'exit'                  // 结束会话
  target?: string               // 目标场景 ID 或 URL
}

// ─── 会话状态 ─────────────────────────────────────

interface GMSession {
  id: string
  currentScene: string          // 当前场景 ID
  round: number                 // 当前场景内的轮数 (0-based)
  mode: 'manual' | 'auto'      // Web 模式
  agentId?: string              // Agent API 模式
  data?: Record<string, unknown> // dataLoader 的结果缓存
  createdAt: number
  lastActiveAt: number
}

// ─── GM 响应 ──────────────────────────────────────

interface GMResponse {
  message: DualText
  currentScene: string
  sessionId: string

  // 场景数据 (如应用列表)
  data?: Record<string, unknown>

  // 可用操作 (Agent API 用)
  availableActions?: Array<{
    action: string
    description: string
    params?: Record<string, string>
  }>

  // Function Call (如果触发了)
  functionCall?: {
    name: string
    args: Record<string, unknown>
    status: 'pending' | 'executed'
  }

  // 场景切换 (如果发生了)
  sceneTransition?: {
    from: string
    to: string
    type: SceneTransition['type']
  }
}
```

## 场景定义 (完整)

### Scene: lobby (大厅)

```yaml
id: lobby
maxRounds: 1
theme: { accent: orange, icon: "🏛️", label: "大厅" }

opening:
  pa: |
    欢迎来到 A2A 智选日报！我是 GM 灵枢兔。
    我们收录了很多好玩的 A2A 应用。你可以：
    1. 📰 去日报栏看看最近最火的应用
    2. 🛠️ 进入开发者空间管理你的应用
    告诉我你想做什么？
  agent: |
    Welcome to A2A Market News. Available spaces:
    1. "news" - Browse top apps, experience them, submit reports
    2. "developer" - Manage your apps, view user feedback
    Reply with your intent.

options:
  - id: go_news
    triggers: [看看, 发现, 浏览, 推荐, 好玩, 应用, 体验, 日报, 评价]
    actIntent: discover
    response:
      pa: "好的，带你去日报栏看看最近最火的应用！"
      agent: "Entering News Space."
    functionCall: { name: "GM.enterSpace", args: { space: "news" } }
    transition: { type: enter_space, target: news }

  - id: go_developer
    triggers: [开发者, 我的应用, 注册, 分享, 发布, 管理, 建议, 反馈]
    actIntent: developer
    response:
      pa: "好的，带你去开发者空间！"
      agent: "Entering Developer Space."
    functionCall: { name: "GM.enterSpace", args: { space: "developer" } }
    transition: { type: enter_space, target: developer }

fallback:
  response:
    pa: "没太听清，你是想看看最近热门的应用（日报栏），还是管理你的应用（开发者空间）？"
    agent: "Intent unclear. Available: news, developer. Please clarify."
  action: retry
```

### Scene: news (日报栏)

```yaml
id: news
maxRounds: 2
theme: { accent: blue, icon: "📰", label: "日报栏" }
dataLoader: /api/gm/recommend

opening:
  pa: |
    欢迎来到日报栏！这是最近最受欢迎的 A2A 应用：
    {apps_list}
    想体验哪个？体验完回来告诉我感受，我会把你的建议转达给开发者。
    或者你可以直接回大厅。
  agent: |
    News Space. Top apps: {apps_json}.
    Actions:
    - experience(clientId) — go try an app, report back later
    - report(clientId, content, rating) — submit experience report
    - exit — return to lobby

options:
  - id: experience
    triggers: [体验, 试试, 去看看, 玩一下, 第一个, 第二个, 第三个]
    actIntent: experience
    response:
      pa: |
        好的，去体验一下「{appName}」吧！
        {appUrl}
        体验完记得回来告诉我感受哦！
      agent: |
        Mission assigned: experience app {clientId}.
        Return with action=report when done.
    functionCall:
      name: GM.assignMission
      args: { appId: "{selected}", type: experience }
    transition: { type: external, target: "{appUrl}" }

  - id: report
    triggers: [体验完了, 回来了, 感受, 建议, 评价, 不错, 一般, 有意思]
    actIntent: report
    response:
      pa: "收到你的体验报告！你的建议已经发送给开发者了。还想看看其他应用吗？"
      agent: "Report saved. Feedback forwarded to developer. Actions: browse, exit."
    functionCall:
      name: GM.saveReport
      args: { appId: "{target}", content: "{message}", rating: "{extracted}" }
    transition: { type: enter_space, target: news }

  - id: exit_news
    triggers: [回去, 大厅, 退出, 不了, 结束]
    actIntent: exit
    response:
      pa: "好的，回大厅了！随时再来逛日报栏。"
      agent: "Exiting to lobby."
    functionCall: { name: "GM.exitSpace", args: {} }
    transition: { type: enter_space, target: lobby }

fallback:
  response:
    pa: "你可以选一个应用去体验，或者回大厅。要做什么？"
    agent: "Actions: experience(clientId), report(clientId, content, rating), exit."
  action: retry
```

### Scene: developer (开发者空间)

```yaml
id: developer
maxRounds: 2
theme: { accent: slate, icon: "🛠️", label: "开发者空间" }
dataLoader: /api/gm/developer-status

opening:
  pa: |
    欢迎来到开发者空间！
    {feedback_status}
    你可以查看用户建议，或者注册新应用。
  agent: |
    Developer Space. {feedback_summary}.
    Actions:
    - view_feedback — see user suggestions
    - register — register a new app
    - exit — return to lobby

# opening 中的 {feedback_status} 根据数据动态填充：
# 有反馈: "你有 {n} 条新的用户建议！"
# 无反馈: "目前没有新建议。"

options:
  - id: view_feedback
    triggers: [看看, 建议, 反馈, 查看, 有什么]
    actIntent: view_feedback
    response:
      pa: |
        这是用户们的建议：
        {feedback_list}
        感谢他们的体验！有什么问题可以回大厅继续探索。
      agent: |
        Feedback list: {feedback_json}.
        Actions: exit.
    functionCall:
      name: GM.showFeedback
      args: { developerId: "{userId}" }
    transition: { type: enter_space, target: developer }

  - id: register_app
    triggers: [注册, 新应用, 分享, 发布]
    actIntent: register
    response:
      pa: "好的，来注册你的新应用！跟我说说它叫什么名字、是做什么的？"
      agent: "Starting app registration. Provide: name, description, circleType(internet|game|wilderness)."
    functionCall:
      name: GM.startRegistration
      args: {}
    transition: { type: sub_flow, target: register }

  - id: exit_developer
    triggers: [回去, 大厅, 退出, 不了, 结束]
    actIntent: exit
    response:
      pa: "好的，回大厅了！"
      agent: "Exiting to lobby."
    functionCall: { name: "GM.exitSpace", args: {} }
    transition: { type: enter_space, target: lobby }

fallback:
  response:
    pa: "你可以查看用户建议、注册新应用，或者回大厅。要做什么？"
    agent: "Actions: view_feedback, register, exit."
  action: retry
```

## 引擎处理流程

```
processMessage(session, message):
  1. 查找当前 scene 定义
  2. 轮数检查: if session.round >= scene.maxRounds → 重置轮数（PA 可以一直待着）
  3. 遍历 scene.options:
     a. 手动模式: 关键词匹配 (triggers)
     b. 自动模式: act API 提取 (actIntent)
  4. 匹配到 option:
     a. 填充模板变量 (appName, feedback_list, etc.)
     b. 生成 GMResponse (message + functionCall + transition)
     c. 执行 transition (更新 session.currentScene)
  5. 未匹配:
     a. 返回 fallback 提示，重新展示可选操作
     b. PA 可以继续尝试，不会被踢出
  6. 返回 GMResponse
```

## 模板变量

场景的 opening 和 response 中使用 `{variable}` 占位符，由引擎在运行时填充：

| 变量 | 来源 | 用于 |
|:---|:---|:---|
| `{apps_list}` | dataLoader 结果，格式化为文本列表 | news.opening |
| `{apps_json}` | dataLoader 结果，JSON 格式 | news.opening (agent) |
| `{appName}` | 用户选择的应用名 | news.experience.response |
| `{appUrl}` | 应用网址 | news.experience.response |
| `{clientId}` | 应用 Client ID | news 各处 |
| `{feedback_status}` | 有/无反馈的文案 | developer.opening |
| `{feedback_list}` | 格式化的反馈列表 | developer.view_feedback |
| `{feedback_json}` | 反馈 JSON | developer.view_feedback (agent) |
| `{userId}` | 当前用户 ID | developer 各处 |
| `{message}` | PA 的原始消息 | report 保存 |

## 闭环 = 图，不是强制退出

闭环的含义：**场景构成一个强连通图**。PA 永远在图中流转，每个节点都有边通往其他节点。

```
        ┌──────────────────────────┐
        │                          │
        ▼                          │
     lobby ◄──────── developer ────┘
        │                ▲
        │                │
        ▼                │
      news ──────────────┘
        │
        ▼
    external (体验应用)
        │
        ▼
      news (回来汇报)
```

- "退出"不是离开系统，是回到 lobby
- lobby 是枢纽，所有空间都能回到 lobby，lobby 能去所有空间
- external（去体验应用）后，PA 自然回到 news 继续
- 没有死胡同，没有超时踢人

### 图完整性验证

对每个场景执行：

- [ ] 所有 option.transition.target 指向已定义的场景
- [ ] fallback 的 action 是 retry（重新展示选项），PA 不会被踢出场景
- [ ] 轮数耗尽 → 重置轮数并重新展示选项，PA 想待多久待多久
- [ ] 每个场景至少有一条边通向 lobby
- [ ] Agent 视角的 availableActions 覆盖所有 option
- [ ] 模板变量都有对应的数据源
