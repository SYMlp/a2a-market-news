## 调研笔记：Task 2.3 GM 编排层职责边界

**来源数量**: gm/engine.ts, api/gm/process/route.ts, gm-orchestration-architecture.md
**时间**: 2026-03-21

### 核心发现

- process/route.ts 为薄路由层：仅做 body 解析、分支分发，编排逻辑全部委托 gm/engine
- gm/engine 作为 facade 重导出 engine + 提供 enterSceneWithAI, processMessageWithAI 等高层封装
- Route 不直接操作 session.flags，通过 session-context 和 engine 完成

### GM Facade 边界

| 职责 | 位置 | 是否泄漏 |
|:---|:---|:---|
| 会话创建/获取 | gm/engine → session | 否 |
| 场景进入/消息处理 | gm/engine → engine | 否 |
| FC 执行 | function-call-executor | 否 |
| 事件日志 | event-logger | 否 |
| SubFlow 路由 | subflow/router | 否 |

Route 层仅做：auth 检查、body 解析、action 分支、调用 gm/engine 或 subflow/router。
