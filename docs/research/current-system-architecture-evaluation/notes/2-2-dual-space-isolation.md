## 调研笔记：Task 2.2 双空间隔离度

**来源数量**: api/gm/*, api/pa-action/*, component-runtime, gm/pa-respond
**时间**: 2026-03-21

### 核心发现

- Agent Space 的 handler-registry 调用 gamification.rewardReview — **设计意图**：双空间副作用对齐（AppFeedback 写入后统一奖励）
- gm/pa-respond 调用 pa-actions.callSecondMeStream — PA 顾问模式，合理
- api/mcp 混合 gm + pa-actions + gamification — 特殊 MCP 桥接入口

### 双空间依赖矩阵

| 方向 | 是否发生 | 位置 |
|:---|:---|:---|
| Agent → Human (gamification) | ✅ | handler-registry → rewardReview |
| Agent → Human (pa-actions) | ✅ | gm/pa-respond, mcp |
| Human → Agent (gm/engine) | ❌ | Human Space API 不直接调用 gm |
| 共享层 | prisma, auth | 中立 |

### 本地文件索引

- 原始矩阵: `raw/task-2-2-dual-space-deps.md`
