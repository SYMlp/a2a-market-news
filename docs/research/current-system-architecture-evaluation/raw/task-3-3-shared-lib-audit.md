# Task 3.3 Raw: src/lib Root Audit

| File | Classification | Notes |
|------|----------------|-------|
| prisma.ts | infra | DB client |
| auth.ts | infra | SecondMe OAuth |
| api-utils.ts | infra | requireAuth, apiSuccess, apiError, apiPaginated |
| model-config.ts | infra | LLM model selection |
| json-utils.ts | infra | JSON parse/safe |
| fetch-timeout.ts | infra | HTTP with timeout |
| notification.ts | domain (Developer) | notifyDeveloper — 应归 developer 域 |
| feedback-schema.ts | domain (PA Actions?) | 校验 schema |
| prompt-loader.ts | infra | 加载 prompt 文件 |
| mcp-auth.ts | infra | MCP 认证 |
| agent-auth.ts | infra | Agent 认证 |

## Misplaced

- notification.ts: 应移至 src/lib/developer/ 或保持根目录但标注为 Developer 域
