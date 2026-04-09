# System Architecture Overview — 四层模型

> Date: 2026-03-17
> Status: confirmed
> Builds on: `pa-lifecycle-architecture.md`, `engine-invariants.md`, `game-loop-architecture.md`

## 1. 起源

人的原始表述：

> 系统最外层的架构。本质上是场景切换，GM 进行切换。
> 状态有用户进场、用户离场。用户指的就是 PA。
> 怎么跟场景中的模板协同，NPC 开始说话，这些都是用户进场这个事件触发的。
> 用户进场，用户活动，用户离场。

评估结论：这个直觉与已有设计完全吻合，且大部分已落地。在此基础上，补充了层级划分和两个未覆盖的设计方向。

## 2. 四层架构

```
┌─────────────────────────────────────────────────────────┐
│  L0: System Entry / Exit                                 │
│  PA 接入系统的入口。当前 = approach 页面（模式选择）。       │
│  进入后创建 session，代表一个 PA 正式接入。                 │
│  退出 = session TTL 过期自然消失（无显式退出事件）。         │
│  状态：已有实现，足够当前需求。                             │
├─────────────────────────────────────────────────────────┤
│  L1: GM Scene Graph                                      │
│  GM 控制场景图。场景是节点，转场是边。                      │
│  GM 是场景路由的唯一权威——PA 不能直接切换场景。              │
│                                                          │
│  lobby ⇄ news                                            │
│  lobby ⇄ developer                                       │
│  状态：已设计 + 已实现。                                   │
├─────────────────────────────────────────────────────────┤
│  L2: PA Lifecycle per Scene                              │
│  每个场景内，PA 经历三个生命周期阶段：                      │
│                                                          │
│  PA_ENTER ──→ PA_ACTIVE ──→ PA_LEAVE                     │
│     ↑ 加载数据       ↑ game loop        ↑ 清理+转场       │
│     ↑ 初始化状态     ↑ AI 分类+NPC      ↑ NPC 告别        │
│     ↑ NPC 开场       ↑ FC 执行          ↑ 清理场景 flags   │
│                                                          │
│  所有场景内行为都是生命周期事件的响应。                      │
│  状态：已设计 + 已实现。                                   │
├─────────────────────────────────────────────────────────┤
│  L3: Turn-Level Game Loop                                │
│  单回合的状态机，运行在 PA_ACTIVE 内部：                    │
│                                                          │
│  PRESENT → AWAIT → RESOLVE → APPLY → (loop)              │
│  状态：已设计 + 已实现。                                   │
└─────────────────────────────────────────────────────────┘
```

层间关系：

- L0 创建 session → L1 路由到首个场景
- L1 决定"去哪个场景" → L2 执行"场景内发生什么"
- L2 的 PA_ACTIVE 内部 → L3 game loop 循环
- L3 的 MOVE 结果 → 触发 L2 的 PA_LEAVE → L1 路由到新场景 → L2 的 PA_ENTER

## 3. 已确认的设计决策

| 决策 | 选择 | 理由 |
|:---|:---|:---|
| L0 入口 | 现有 approach 页 + session 创建 | PA 进入系统 = session 创建，已足够 |
| L0 退出 | 隐式（TTL 过期） | 当前无需显式退出事件 |
| GM 场景权威 | GM 是唯一场景路由者 | PA 不能直接设 currentScene |
| 三角色分工 | PA 说话、NPC 回应、GM 裁决 | 职责不混淆 |
| PA 生命周期 | ENTER → ACTIVE → LEAVE | 所有场景行为都是生命周期事件驱动 |

## 4. 识别到的设计方向（未实现）

### 4.1 GM 主动编排能力

当前 GM 是被动的——PA 选了 move action，GM 执行。缺少主动编排：

| 能力 | 描述 | 优先级 |
|:---|:---|:---|
| GM 主动传送 | GM 基于时间/事件强制把 PA 转到某个场景 | 中 |
| GM 拒绝移动 | GM 可以否决 PA 的 move 请求（如前置条件不满足） | 低（precondition 已部分覆盖） |
| GM 事件广播 | GM 向当前场景所有 PA 广播系统事件 | 取决于多 PA 需求 |

### 4.2 多 PA 同场

当前 session 模型是单 PA 隔离的，每个 PA 有独立 session，互不感知。

如果未来要做"PA 在同一场景里遇到其他 PA"（如 PA 间对话、协作体验），需要：

| 维度 | 当前 | 需要演进到 |
|:---|:---|:---|
| Session 模型 | per-PA isolated | room-based（场景 = 房间，多 PA 共享状态） |
| NPC 对话 | 1:1（NPC ↔ 单个 PA） | 1:N 或 N:N（NPC 面对多个 PA） |
| 状态可见性 | PA 只看到自己的 flags | PA 可看到房间内其他 PA 的公开状态 |
| 事件模型 | 请求-响应 | 需要引入事件总线或 pub/sub |

这是架构级变更，不适合渐进式修改，需要专项设计。

## 5. 文档依赖关系

```
本文档 (system-architecture-overview.md)
  ├── 引用 → pa-lifecycle-architecture.md (L2 详细定义)
  ├── 引用 → engine-invariants.md (L3 不变量 + 视觉不变量)
  ├── 引用 → game-loop-architecture.md (L3 详细定义)
  └── 引用 → DESIGN-V2.md (业务设计 + 对话链架构)
```
