# Game Loop Architecture: Turn-Based Interaction Model

> 推导来源：游戏者视角对 PA 场景行为的抽象
> 前置文档：`docs/script-engine-spec.md`（剧本引擎规格）、`meta/derivation/a2a-interaction-paradigm-three-layer-projection-2026-03-16.md`
> 状态：confirmed
> 日期：2026-03-16

## 1. 核心洞察

PA 在任何场景中的行为可以归结为**递归二叉决策树**：

```
进入场景 → 呈现(opening + 可选行动)
  │
  ├── REST(N秒) ─────→ sleep(N) → 重新呈现同一场景（数据可能已刷新）
  │
  └── ACT(actionId) ──→ 执行 → 判定结果
                          │
                          ├── STAY ──→ 场景内效果 + 重新呈现（状态已变）
                          │
                          └── MOVE ──→ 进入新场景 → 递归
```

两层二选一：

| 层级 | 选择 | 本质 |
|:---|:---|:---|
| **第一层** | REST vs ACT | 是否产生行为 |
| **第二层**（仅 ACT） | STAY vs MOVE | 行为是否改变位置 |

每次递归都回到同一个起点：**呈现场景 → 等待决策**。整个交互就是这棵二叉树的无限展开。

## 2. 关键设计决策

### 2.1 outcome 是声明式的

每个 action 在定义时就声明它的结果类型（`stay` 或 `move`），不是运行时推断。

理由：Agent 需要在选择前就知道后果——"选这个我会离开当前场景"还是"选这个我留在这里"。这是 Agent 做决策的关键信息。

### 2.2 REST 是一等公民

REST 不是"用户不操作"的被动状态，而是一个**显式的 turn type**，可以被 function call 封装。

- Agent API：Agent 发送 `{ turn: "rest", seconds: 30 }`
- Web 手动模式：用户不操作 = 隐式 rest，不需要发请求
- Web 自动模式：`setTimeout(runAutoStep, seconds * 1000)`

REST 回来后场景数据会重新加载（dataLoader re-execute），实现**刷新观察**的效果。

### 2.3 Meta Actions 统一提取

通用操作不写在场景定义里，由引擎自动注入：

| 元操作 | 含义 | outcome | 可用场景 |
|:---|:---|:---|:---|
| `rest(seconds)` | 原地休息 | stay（刷新数据后重新呈现） | 所有场景 |
| `back` | 回大厅 | move → lobby | 除 lobby 外 |
| `help` | GM 重新解释当前场景 | stay（重新呈现 opening） | 所有场景 |

场景定义只需写**场景特有的行动**。

## 3. 类型系统

```typescript
// ═══════════════════════════════════════════
//  第一层：玩家回合（PlayerTurn）
// ═══════════════════════════════════════════

type PlayerTurn =
  | { type: 'rest'; seconds: number }
  | { type: 'act'; actionId: string; params?: Record<string, unknown> }

// ═══════════════════════════════════════════
//  第二层：回合结果（TurnOutcome）
// ═══════════════════════════════════════════

type TurnOutcome =
  | TurnOutcomeStay
  | TurnOutcomeMove

interface TurnOutcomeStay {
  type: 'stay'
  effect: SceneEffect
  message: DualText
}

interface TurnOutcomeMove {
  type: 'move'
  target: string
  transitionType: TransitionType
  message: DualText
}

type TransitionType = 'enter_space' | 'sub_flow' | 'external'

// ═══════════════════════════════════════════
//  场景内效果（SceneEffect）
// ═══════════════════════════════════════════

interface SceneEffect {
  dataUpdate?: Record<string, unknown>
  functionCall: FunctionCall
  refreshData?: boolean
}

// ═══════════════════════════════════════════
//  场景呈现（ScenePresentation）
// ═══════════════════════════════════════════

interface ScenePresentation {
  sceneId: string
  opening: DualText
  actions: ActionSlot[]
  meta: MetaActionType[]
  data?: Record<string, unknown>
}

type MetaActionType = 'rest' | 'back' | 'help'

// ═══════════════════════════════════════════
//  行动槽位（ActionSlot）
// ═══════════════════════════════════════════

interface ActionSlot {
  id: string
  label: DualText
  outcome: 'stay' | 'move'
  available: boolean
  disabledReason?: string
  params?: ParamSpec[]
}

interface ParamSpec {
  name: string
  required: boolean
  description?: string
}

// ═══════════════════════════════════════════
//  API 请求/响应
// ═══════════════════════════════════════════

interface TurnRequest {
  sessionId: string
  turn: PlayerTurn
}

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
  delay?: number
}
```

## 4. 游戏主循环

```
┌─────────────────────────────────────────────┐
│              GAME LOOP                       │
│                                              │
│  ┌──────────┐                                │
│  │ PRESENT  │ ← 加载场景数据 + 渲染呈现       │
│  └────┬─────┘                                │
│       │ ScenePresentation                    │
│       ▼                                      │
│  ┌──────────┐                                │
│  │  AWAIT   │ ← 等待玩家输入（阻塞）          │
│  └────┬─────┘                                │
│       │ PlayerTurn                           │
│       ▼                                      │
│  ┌──────────┐                                │
│  │ RESOLVE  │ ← REST → stay / ACT → stay|move│
│  └────┬─────┘                                │
│       │ TurnOutcome                          │
│       ▼                                      │
│  ┌──────────┐                                │
│  │  APPLY   │ ← 更新 session + 执行 FC       │
│  └────┬─────┘                                │
│       │                                      │
│       └──────────── loop ───────────────────→│
└─────────────────────────────────────────────┘
```

四阶段职责：

| 阶段 | 输入 | 输出 | 性质 |
|:---|:---|:---|:---|
| PRESENT | session state | ScenePresentation | 纯读取 |
| AWAIT | presentation | PlayerTurn | 阻塞等待 |
| RESOLVE | session + turn | TurnOutcome | 纯计算 |
| APPLY | session + outcome | side effects | 有副作用 |

### PRESENT

```typescript
async function presentScene(session: GameSession): Promise<ScenePresentation> {
  const scene = getScene(session.currentScene)

  // 执行 dataLoader（如果有）
  const data = scene.dataLoader
    ? await fetch(scene.dataLoader).then(r => r.json())
    : session.data

  return {
    sceneId: scene.id,
    opening: fillTemplate(scene.opening, data),
    actions: scene.actions.map(a => toActionSlot(a, session)),
    meta: buildMetaActions(scene.id),
    data,
  }
}
```

### RESOLVE

```typescript
async function resolveTurn(
  session: GameSession,
  turn: PlayerTurn,
): Promise<TurnOutcome> {

  // ── REST ──
  if (turn.type === 'rest') {
    return {
      type: 'stay',
      effect: {
        functionCall: { name: 'GM.rest', args: { seconds: turn.seconds } },
        refreshData: true,
      },
      message: {
        pa: `休息一下，${turn.seconds}秒后看看有什么新动态。`,
        agent: `Resting for ${turn.seconds}s. Scene data will refresh.`,
      },
    }
  }

  // ── META: back ──
  if (turn.actionId === '_back') {
    return {
      type: 'move',
      target: 'lobby',
      transitionType: 'enter_space',
      message: { pa: '回大厅了！', agent: 'Returning to lobby.' },
    }
  }

  // ── META: help ──
  if (turn.actionId === '_help') {
    const scene = getScene(session.currentScene)
    return {
      type: 'stay',
      effect: {
        functionCall: { name: 'GM.help', args: {} },
        refreshData: false,
      },
      message: scene.opening,
    }
  }

  // ── SCENE ACTION ──
  const scene = getScene(session.currentScene)
  const action = scene.actions.find(a => a.id === turn.actionId)

  if (!action) {
    return {
      type: 'stay',
      effect: {
        functionCall: { name: 'GM.fallback', args: {} },
        refreshData: false,
      },
      message: scene.fallback.response,
    }
  }

  const fcResult = await executeFunctionCall(action.functionCall, turn.params)

  if (action.outcome === 'stay') {
    return {
      type: 'stay',
      effect: {
        dataUpdate: fcResult,
        functionCall: action.functionCall,
        refreshData: true,
      },
      message: fillTemplate(action.response, { ...session.data, ...fcResult }),
    }
  }

  return {
    type: 'move',
    target: action.transition!.target!,
    transitionType: action.transition!.type,
    message: fillTemplate(action.response, session.data),
  }
}
```

### APPLY

```typescript
async function applyResult(
  session: GameSession,
  outcome: TurnOutcome,
): Promise<void> {
  if (outcome.type === 'stay') {
    if (outcome.effect.dataUpdate) {
      session.data = { ...session.data, ...outcome.effect.dataUpdate }
    }
    session.round++
  } else {
    // MOVE: 切换场景
    session.currentScene = outcome.target
    session.round = 0
    session.data = undefined
  }
  session.lastActiveAt = Date.now()
}
```

## 5. 场景定义格式（v2）

```typescript
interface SceneDefinition {
  id: string
  opening: DualText
  dataLoader?: string

  actions: SceneAction[]

  fallback: {
    response: DualText
  }

  theme: {
    accent: string
    icon: string
    label: string
  }
}

interface SceneAction {
  id: string
  outcome: 'stay' | 'move'
  label: DualText
  triggers: string[]
  actIntent?: string
  response: DualText
  functionCall: FunctionCall
  transition?: { type: TransitionType; target?: string }
  precondition?: {
    check: string     // 引用一个条件函数名
    failMessage: DualText
  }
  params?: ParamSpec[]
}
```

与 v1 的差异：

| 字段 | v1 | v2 |
|:---|:---|:---|
| `maxRounds` | 场景级，控制轮数 | **移除**——轮数由 meta:help 自动处理 |
| `outcome` | 不存在，隐含在 transition 中 | **新增**，声明式 |
| `back_lobby` option | 每个场景重复写 | **移除**，由 meta:back 自动注入 |
| `fallback.action` | `'retry' \| 'hub'` | **移除**——fallback 永远是 stay + 重新提示 |
| `precondition` | 不存在 | **新增**，行动前置条件 |
| `label` | 不存在 | **新增**，给人/给 Agent 的行动描述 |

## 6. 场景图 + 行动分类

```
                    ┌─ rest ──→ sleep(N) ──→ refresh ─┐
                    │                                   │
                    ▼                                   ▼
              ┌──────────┐
  ┌──────────►│  LOBBY   │◄─────────── meta:back ──────────────┐
  │           └────┬─────┘                                      │
  │                │                                            │
  │     ┌──────────┴───────────┐                                │
  │     │ act: go_news [move]  │ act: go_developer [move]       │
  │     ▼                      ▼                                │
  │  ┌────────────┐       ┌──────────────┐                      │
  │  │    NEWS    │       │  DEVELOPER   │                      │
  │  ├────────────┤       ├──────────────┤                      │
  │  │ experience │[move] │ view_feedback│[stay]                │
  │  │ report     │[stay] │ register     │[move→sub_flow]       │
  │  └────────────┘       └──────────────┘                      │
  │       │                      │                              │
  │       └──────────────────────┴─── meta:back ───────────────►┘
  │
  └──── 所有场景共享：meta:rest [stay] / meta:back [move] / meta:help [stay]
```

## 7. REST 作为刷新观察

REST 不只是空等。每次 rest 结束后，场景的 `dataLoader` 会重新执行：

```
PA rest(60)
  → 60秒后
  → dataLoader 重新执行（/api/gm/recommend）
  → 可能有新应用上榜 / 新反馈到达
  → 重新呈现场景（actions 列表可能变化）
  → PA 看到更新后的内容 → 决策
```

Agent 自动模式下的轮询模式：

```
Agent: act(view_feedback) → stay, 看到 3 条反馈
Agent: rest(60)            → 等 60 秒
Agent: rest(0)             → 立即刷新，发现 5 条反馈（新增 2 条）
Agent: act(view_feedback) → stay, 看到 5 条反馈
```

## 8. 兼容层

现有的 `POST /api/gm/process { action: "message", message }` 接口通过兼容层转换：

```typescript
function legacyToTurn(action: string, message?: string, sceneId?: string): PlayerTurn {
  if (action === 'enter') {
    // enter 场景 → 不是一个 turn，而是 session 初始化
    return { type: 'act', actionId: '_enter' }
  }

  // message → 走 keyword 匹配 → 转成 act
  const scene = getScene(sceneId!)
  const matched = matchOption(scene.actions, message!)
  if (matched) {
    return { type: 'act', actionId: matched.id }
  }

  // 未匹配 → fallback（也是一种 stay）
  return { type: 'act', actionId: '_fallback' }
}
```

## 9. 实施路径

| 阶段 | 内容 | 改动范围 |
|:---|:---|:---|
| **P1: 类型层** | 新增 PlayerTurn、TurnOutcome、ActionSlot 等类型 | `types.ts` |
| **P2: 引擎层** | 拆分 processMessage → extractTurn + resolveTurn + applyResult | `engine.ts` |
| **P3: 场景层** | 场景定义加 outcome 字段，移除重复的 back_lobby | `scenes.ts` |
| **P4: API 层** | 新增 `/api/gm/turn` 端点 + 兼容层 | `api/gm/turn/route.ts` |
| **P5: 前端层** | 自动模式改用 TurnRequest/TurnResponse | `lobby/page.tsx` |

P1-P3 可以一次完成（纯重构，不改行为）。P4-P5 可以增量推进。
