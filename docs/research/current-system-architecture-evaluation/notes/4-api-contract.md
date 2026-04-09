## 调研笔记：Task 4 API 契约一致性

**来源数量**: 采样 20+ route，api-utils, human-space-domain-map
**时间**: 2026-03-21

### 响应格式合规率

- 多数 Human Space API 使用 apiSuccess/apiError/apiPaginated 或等效格式
- pa-directory 使用自定义 pagination 结构（与 apiPaginated 的 total/page 略有差异）
- 合规率估计: ~90%

### Auth 模式

| 模式 | 使用场景 |
|:---|:---|
| requireAuth() | points, daily-tasks, my-reviews, practices POST |
| getCurrentUser + if (!user) 401 | pa-action/*, developer/*, gm/*, 其余 |

两种模式并存，均能达到认证目的。

### 错误处理

- 无统一中间件，各 route 自行 try-catch
- 错误信息以中文为主（user-facing）
