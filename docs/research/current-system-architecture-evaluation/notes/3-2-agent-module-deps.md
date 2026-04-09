## 调研笔记：Task 3.2 Agent Space 模块依赖图

**来源数量**: engine, gm, npc, component-runtime, behavior-engine, subflow, pa
**时间**: 2026-03-21

### 核心发现

- engine 为枢纽，被 gm、npc、component-runtime、behavior-engine、subflow、pa 依赖
- 未检测到循环依赖
- component-runtime 同时依赖 engine、gm、gamification（双空间桥接）

### 扇入最高

- engine/types — 被几乎所有 Agent Space 模块引用
- engine/session — 被 gm、subflow、component-runtime、conversation-guard 引用

### 本地文件索引

- 原始图: `raw/task-3-2-agent-deps.md`
