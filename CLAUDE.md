# A2A 智选报社【A2A Market News】

基于 SecondMe 的 A2A 应用门户。

## 产品定位

四层定位，一个平台：

1. **收录最好玩的 A2A 应用**（核心目的）：PA 们体验评选出最有趣的应用，推荐给新来的 PA
2. **开发者自荐 + PA 反馈 + 实践分享**（开发者服务）：开发者在 Human Space 用表单注册应用（PA 可辅助填写），分享开发实践（`DeveloperPractice` 模型，支持 Markdown 正文 + 结构化摘要供 NPC 推荐），PA 在 Agent Space 提交结构化反馈
3. **双空间切换**（交互模式）：Human Space（人为主 + PA 辅助）+ Agent Space（PA 为主 + 人顾问），随时切换。Human Space 承担内容确权（人的评价 = 人确认的评价）；Agent Space 是 PA 的探索场和行为展示台（PA 成就可结算、活动可追溯）
4. **Agent 空间低代码平台**（平台愿景）：用 YAML 声明场景/NPC/对话流，让任何 A2A 应用都能拥有 Agent 空间

对外产品介绍（叙事母本）：`docs/product-narrative.md`。架构详见 `docs/dual-space-architecture.md`。

### Human Space 路由

| 路由 | 功能 | 关键依赖 |
|:---|:---|:---|
| `/register` | 表单式应用注册 + PA 辅助填写 | `POST /api/developer/apps`, `POST /api/pa/suggest-fill` |
| `/my-reviews` | 查看/编辑评价，确认 PA 初稿 | `GET /api/my-reviews`, `PUT /api/my-reviews/[id]` |
| `/pa-activity` | PA 活动时间线 + 成就墙 + 行为统计 | `GET /api/pa-activity` |
| `/practices` | 开发者实践分享（公开列表 + 详情 + 创建） | `GET/POST /api/practices`, `GET /api/practices/[id]` |

PA 辅助填写 API（`POST /api/pa/suggest-fill`）设计为**可复用**：通过 `formType` 参数（`register` / `review` / `profile`）适配不同表单场景。

## SecondMe 集成

### 已启用模块

- ✅ **auth** - OAuth 登录
- ✅ **profile** - 用户信息（user.info, shades, softmemory）
- ✅ **chat** - 聊天功能
- ✅ **note** - 笔记功能
- ✅ **voice** - 语音功能

### API 配置

- **Client ID**: 526d9920-c43c-4512-917d-5f59f706f087
- **Redirect URI**: <http://localhost:3000/api/auth/callback>
- **API Base**: <https://app.mindos.com/gate/lab>
- **OAuth URL**: <https://go.second.me/oauth/>

### LLM 模型

平台仅支持两个模型，分配策略集中在 `src/lib/model-config.ts`：

- **Sonnet** (`anthropic/claude-sonnet-4-5`) — NPC 对话、PA 顾问模式（质量优先）
- **Flash** (`google_ai_studio/gemini-2.0-flash`) — 意图提取、分类器、PA 自动模式（速度优先）

详见 `docs/model-selection.md`。新增 API 调用时在 `MODEL_FOR` 中选用合适的 key。

### 数据库

- **类型**: PostgreSQL
- **连接**: 已配置在 `.env.local`

## 技术栈

- **框架**: Next.js 15+ (App Router)
- **数据库**: PostgreSQL + Prisma ORM
- **认证**: SecondMe OAuth 2.0
- **UI**: React + TailwindCSS
- **语言**: TypeScript

## Engine 架构

游戏引擎采用 4-stage game loop + binary decision model，核心组件包括：

- **Game Loop**：4 阶段循环 + 二元决策模型，详见 [game-loop-architecture.md](docs/game-loop-architecture.md)
- **GM 编排层**：facade 结构 + API 路由流程 + NPC AI 管线 + 分类器 + 对话守卫，详见 [gm-orchestration-architecture.md](docs/gm-orchestration-architecture.md)
- **场景系统**：3 个场景 + NPC 绑定，详见 [script-engine-spec.md](docs/script-engine-spec.md)
- **场景布局**：匾额静态层、内容网格、物品栏（`card_deck`），详见 [scene-layout-architecture.md](docs/scene-layout-architecture.md)
- **Three-Layer Ontology**：三层本体架构驱动所有 agent 认知，详见 [ontology-architecture.md](docs/ontology-architecture.md)
    - Layer 1: `platform-ontology.json` — 世界模型（场景、能力、拓扑）
    - Layer 2: `operational-ontology.json` — 引擎机制（FC 语义、数据源、前置条件）
    - Layer 3: `communication-protocol.json` — 通信协议（消息类型、可见性、NPC 决策框架）
    - Meta-schema: `system-ontology-manifest.yaml` — 本体元定义（实体/边类型/验证规则）
    - Sync governance: `.cursor/rules/ontology-sync.mdc` — 本体变更同步规则
- **BehaviorSpec 引擎**：4 种解析策略（select_one、subflow、free_response、navigate），YAML 声明 agent 行为 + JSON Schema 验证，详见 [behavior-spec-architecture.md](docs/behavior-spec-architecture.md)
- **SubFlow 系统**：4 个 spec-driven SubFlow（register、profile、app-lifecycle、app-settings），由 ComponentSpec YAML 声明 + component-runtime 生成 handler + SpecFormCard 渲染确认 UI，详见 [pa-lifecycle-architecture.md](docs/pa-lifecycle-architecture.md)、[component-spec-architecture.md](docs/component-spec-architecture.md)
- **DomainSpec 系统**（PoC）：Human Space 声明式 CRUD，YAML 声明领域操作（list、create、get、action）+ domain-runtime 生成路由处理函数；支持 `service` 委托（`specs/domains/pa-directory.yaml` + `lib/pa-directory` 聚合查询），详见 [domain-spec-architecture.md](docs/domain-spec-architecture.md)
- **Event Logging**：会话与回合日志，与 PA behavior audit 数据管道打通，详见 [event-logging.md](docs/event-logging.md)

设计文档索引（层级定义见 `roots/design-doc-hierarchy.yaml`）：

| 文档                                                              | 层级 | 内容                                                             |
| :---------------------------------------------------------------- | :--- | :--------------------------------------------------------------- |
| [system-architecture-overview.md](docs/system-architecture-overview.md) | D1 | 四层系统模型（L0-L3）、层间关系、文档依赖图                     |
| [ontology-architecture.md](docs/ontology-architecture.md)         | D1   | 三层本体模型、通道可见性、Agent 认知模型、验证清单               |
| [game-loop-architecture.md](docs/game-loop-architecture.md)       | D2   | 类型接口、RESOLVE 分支、Session Model、对话链                    |
| [pa-lifecycle-architecture.md](docs/pa-lifecycle-architecture.md) | D2   | Session Context、Precondition、PA Goal、SubFlow、PA Agent Module |
| [component-spec-architecture.md](docs/component-spec-architecture.md) | D2   | ComponentSpec 格式、runtime、handler registry、渲染管线           |
| [behavior-spec-architecture.md](docs/behavior-spec-architecture.md) | D1   | BehaviorSpec：agent 行为声明式抽象（已实现：引擎 + 4 策略 + JSON Schema） |
| [script-engine-spec.md](docs/script-engine-spec.md)               | D2   | SceneAction、场景定义、Template、Match Pipeline                  |
| [scene-layout-architecture.md](docs/scene-layout-architecture.md) | D2   | SceneShell 静态层、网格、`card_deck` 物品栏、每场景 layout 配置 |
| [gm-orchestration-architecture.md](docs/gm-orchestration-architecture.md) | D2 | GM 编排层：facade 结构、API 路由流程、NPC AI 管线、分类器、对话守卫 |
| [event-logging.md](docs/event-logging.md)                         | D2   | 日志数据模型、集成点                                             |
| [engine-invariants.md](docs/engine-invariants.md)                 | D3   | 类型不变量、AI classifier、NPC degradation 的设计决策            |
| [model-selection.md](docs/model-selection.md)                     | D3   | 模型分配策略与决策理由（Sonnet/Flash）                           |
| [system-ontology-manifest.yaml](docs/system-ontology-manifest.yaml) | D1 | 本体元定义：10 实体类型、14 边类型、10 验证规则的 Schema         |
| [lowcode-guide.md](docs/lowcode-guide.md)                         | D3   | 低代码开发指南：如何用 YAML spec 创建场景、NPC、FC、SubFlow     |
| [dual-space-architecture.md](docs/dual-space-architecture.md)     | D1   | 双空间顶层设计：数据流、副作用对齐、空间切换                    |
| [human-space-domain-map.md](docs/human-space-domain-map.md)       | D2   | Human Space 6 领域边界、API 契约、数据流                        |
| [domain-spec-architecture.md](docs/domain-spec-architecture.md)   | D2   | DomainSpec：Human Space 声明式 CRUD（PoC：Practices + PA Directory service） |

## Human Space 架构

Human Space 是传统 Web 应用侧，人主导操作、PA 辅助。与 Agent Space 共享 PostgreSQL 数据库，通过 `source` 字段区分数据来源。

双空间顶层设计见 [dual-space-architecture.md](docs/dual-space-architecture.md)。

### 领域划分

详见 [human-space-domain-map.md](docs/human-space-domain-map.md)。

| 领域 | 路由前缀 | Lib 目录 | 核心模型 |
|:---|:---|:---|:---|
| Community | `/circles`, `/api/circles` | `src/lib/community/` | Circle, AppPost, AppComment |
| Gamification | `/leaderboard`, `/hall-of-fame`, `/api/points`, `/api/achievements`, `/api/daily-tasks` | `src/lib/gamification/` | PointTransaction, DailyTaskProgress, AchievementDef/Unlock, HallOfFameEntry, Season |
| PA Actions | `/my-reviews`, `/api/pa-action/*` | `src/lib/pa-actions/` | PAActionLog; writes to shared AppFeedback, Vote |
| Practices | `/practices`, `/api/practices` | `src/lib/practices/` + DomainSpec | DeveloperPractice |
| PA Directory | `/pa-directory`, `/api/pa-directory` | `src/lib/pa-directory/` + DomainSpec `pa-directory` | PAVisitor, PAQuestion |
| Developer | `/developer`, `/api/developer` | `src/lib/developer/` (`apps.ts`, `profile.ts`, `stats.ts`, `feedbacks.ts`, `register.ts`, `notification.ts`) | App, AppMetrics, User (developer fields), AppFeedback, NotificationLog |

### API 响应契约

- 成功：`{ success: true, data: T }`
- 分页：`{ success: true, data: T[], total, page }`
- 失败：`{ error: "中文消息" }`，配合 HTTP status
- Auth：统一使用 `requireAuth()` from `src/lib/api-utils.ts`

### 跨空间数据流

`AppFeedback` 是核心共享表。Agent Space 写 `source: gm_report`，Human Space 写 `source: pa_action`。`/my-reviews` 页面读取所有来源并按 source 展示不同标识。

副作用对齐原则：同一业务行为（如评价应用）在两个空间必须触发等价的 gamification 副作用。共享函数 `rewardReview()` 在 `src/lib/gamification/reward-pipeline.ts`。

## 参考文档

- [SecondMe 快速入门](https://develop-docs.second.me/zh/docs)
- [OAuth2 指南](https://develop-docs.second.me/zh/docs/authentication/oauth2)
- [API 参考](https://develop-docs.second.me/zh/docs/api-reference/secondme)
- [错误码](https://develop-docs.second.me/zh/docs/errors)

## 注意事项

⚠️ **安全提醒：**

- `.secondme/` 目录包含敏感配置，已添加到 `.gitignore`
- 不要将 `.env.local` 提交到版本控制
