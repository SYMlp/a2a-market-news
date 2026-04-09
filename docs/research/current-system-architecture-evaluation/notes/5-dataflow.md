## 调研笔记：Task 5 数据流与副作用审计

**来源数量**: handler-registry, pa-action/review, reward-pipeline, session-context
**时间**: 2026-03-21

### AppFeedback 端到端

| 路径 | 写入 | 副作用 |
|:---|:---|:---|
| Agent (fc.saveReport) | AppFeedback source=gm_report | rewardReview ✅ |
| Human (pa-action/review) | AppFeedback source=pa_action | rewardReview ✅ |

**对齐**: 两条路径均调用 rewardReview，副作用一致。

### Session 状态变更

- 规范路径: session-context.ts 提供的函数（recordEvent, setReturnContext, clearSceneScopedFlags 等）
- Route 层通过 session-context 间接修改，未发现直接写 session.flags 的 route
