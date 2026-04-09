## 调研笔记：Task 3.3 共享工具层审计

**来源数量**: prisma, auth, api-utils, model-config, json-utils, fetch-timeout, notification, feedback-schema, prompt-loader, mcp-auth, agent-auth
**时间**: 2026-03-21

### 分类表

| 类型 | 文件 |
|:---|:---|
| infra | prisma, auth, api-utils, model-config, json-utils, fetch-timeout, prompt-loader, mcp-auth, agent-auth |
| domain | notification (Developer), feedback-schema (PA Actions) |
| misplaced | notification — 建议移至 src/lib/developer/ 或标注领域归属 |

### 本地文件索引

- 原始表: `raw/task-3-3-shared-lib-audit.md`
