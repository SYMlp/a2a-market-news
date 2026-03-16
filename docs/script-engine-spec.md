# 剧本引擎规格 (Script Engine Spec)

> 架构指导文档：定义 GM 如何引导 PA/Agent 在平台内交互
> 推导来源：meta/derivation/a2a-interaction-paradigm-three-layer-projection-2026-03-16.md
> **上层架构**：`docs/game-loop-architecture.md`（回合制交互模型 — 递归二叉决策树）

## 上层架构关系

本文档定义**场景内容**（每个场景有什么、能做什么）。
上层的 Game Loop Architecture 定义**交互模型**（PA 如何在场景间流转、每回合的决策结构）。

核心模型：PA 每回合做两层二选一决策 → REST(stay) | ACT → STAY | MOVE。
类型定义见 `src/lib/gm/types.ts`。

## 核心约束

| 约束 | 值 | 理由 |
|:---|:---|:---|
| 回合决策 | REST or ACT | 递归二叉决策树的第一层 |
| ACT 结果 | STAY or MOVE | 第二层，声明式写在 action 定义里 |
| 场景切换方式 | Function Call | 统一执行层 |
| 文本人称 | PA 视角 + Agent 视角 | 双模式呈现 |
| 驻留自由 | PA 可以无限停留在任何场景 | 图中的节点，不是限时房间 |
| 通用操作 | rest / back / help | 由引擎注入，场景不重复定义 |

## 类型定义

> 完整类型定义见 `src/lib/gm/types.ts`
> 架构设计见 `docs/game-loop-architecture.md` §3

### v2 核心类型（当前）

```typescript
// ─── 回合输入 ─────────────────────────────────────

type PlayerTurn =
  | { type: 'rest'; seconds: number }       // 休息：sleep → 刷新场景
  | { type: 'act'; actionId: string; params?: Record<string, unknown> }  // 行动：选择场景内操作

// ─── 回合结果 ─────────────────────────────────────

type TurnOutcome =
  | { type: 'stay'; effect: SceneEffect; message: DualText }   // 留在当前场景
  | { type: 'move'; target: string; transitionType: TransitionType; message: DualText }  // 切换场景

// ─── 场景行动（声明式 outcome）─────────────────────

interface SceneAction {
  id: string
  outcome: 'stay' | 'move'     // 声明式：选这个行动会留还是走
  label: DualText               // 给人/给 Agent 的行动描述
  triggers: string[]
  actIntent?: string
  response: DualText
  functionCall: FunctionCall
  transition?: { type: TransitionType; target?: string }
  precondition?: { check: string; failMessage: DualText }
  params?: ParamSpec[]
}

// ─── 场景呈现 ─────────────────────────────────────

interface ScenePresentation {
  sceneId: string
  opening: DualText
  actions: ActionSlot[]         // 场景特有行动（含 available 状态）
  meta: MetaActionType[]        // 通用操作：rest / back / help
  data?: Record<string, unknown>
}

// ─── 行动槽位 ─────────────────────────────────────

interface ActionSlot {
  id: string
  label: DualText
  outcome: 'stay' | 'move'
  available: boolean
  disabledReason?: string
  params?: ParamSpec[]
}

// ─── 统一 API 响应 ─────────────────────────────────

interface TurnResponse {
  sessionId: string
  scene: { id: string; label: DualText }
  message: DualText
  actions: ActionSlot[]
  meta: MetaActionType[]
  outcome?: {
    type: 'stay' | 'move'
    functionCall?: FunctionCall
    transition?: { from: string; to: string }
  }
  data?: Record<string, unknown>
  delay?: number                // REST 时建议的等待毫秒数
}
```

### v1 类型（兼容，逐步淘汰）

v1 类型（SceneOption、SceneTransition、GMSession、GMResponse）仍保留在 `types.ts` 中，
标记为 `@deprecated`，供现有 engine.ts / scenes.ts / API routes 继续使用。
引擎重构（P2）完成后移除。

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
