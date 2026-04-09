## 调研笔记：Task 1.2 设计文档层级一致性

**来源数量**: system-architecture-overview, game-loop, pa-lifecycle, gm-orchestration, engine-invariants
**时间**: 2026-03-21

### 核心发现

- D1 的 L0-L3 概念在 D2 中有对应展开
- D3 的 engine-invariants 可追溯到 game-loop-architecture（L3 详细定义）
- 存在命名空间重叠：game-loop 的 L1/L2（PlayerTurn/TurnOutcome）与架构的 L1/L2 不同含义

### 层级断裂

| 类型 | 描述 |
|:---|:---|
| 无 | D1 引用的 pa-lifecycle, engine-invariants, game-loop, DESIGN-V2 均存在且内容对应 |
| 命名 | game-loop 中 L1=PlayerTurn, L2=TurnOutcome 与架构层 L1/L2 易混淆 |

### 本地文件索引

- 原始追踪: `raw/task-1-2-hierarchy-trace.md`
