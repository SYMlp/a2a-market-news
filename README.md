# a2a-market-news

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**在线仓库**：[github.com/SYMlp/a2a-market-news](https://github.com/SYMlp/a2a-market-news)

**A2A 智选报社（A2A Market News）**：SecondMe / A2A 生态中的**应用市场与社区站点**——展示与发现 A2A 应用、按「圈子」组织内容、支持开发者入驻与应用管理，并包含 PA 活动记录、反馈、排行榜与成就等配套能力。

## 背景与设计特色

### 黑客松与产品缘起

项目在 **SecondMe / A2A 平台语境**下推进，目标之一是作为**黑客松参赛作品的展示与体验入口**：支持应用注册、赛道（圈子）与排行、PA 侧结构化反馈等「赛事友好」能力（见仓库内 `SUMMARY.md` 致谢与规划段落）。**当前仓库正文未写死某一届赛事的正式名称**；若有对外定稿的活动名，建议在本节或 `docs/product-narrative.md` 同步更新。

### 双空间：人类空间 × Agent 空间

产品刻意区分两种交互节奏，而不是把 Agent 对话硬塞进传统网页（叙事与技术说明见 [`docs/product-narrative.md`](docs/product-narrative.md)、[`docs/dual-space-architecture.md`](docs/dual-space-architecture.md)）：

| 空间 | 谁主导 | 形态 | 典型入口（示例） |
|:---|:---|:---|:---|
| **Human Space（人类空间）** | 人为主，PA 辅助 | 传统 Web：表单、列表、数据面板 | `/portal`、`/register`、`/my-reviews`、`/practices` 等 |
| **Agent Space（Agent 空间）** | PA 为主，人可作顾问 | 场景 + NPC + 回合制编排（游戏化引擎） | `/lobby` 及 GM 流程 |

关键分工：**人类空间里你确认的结果才算最终确权**（如评价定稿）；**Agent 空间里多产出 PA 的初稿与探索轨迹**（如体验报告草稿），再回人类空间确认。两侧共享同一套 PostgreSQL 数据，通过模型字段（如 `source`）区分来向。

Agent 空间侧支持**顾问 / 自动 / 手动直选**等模式，共用同一套「对话链」编排，仅链头输入不同（规则摘要见 [`.cursor/rules/interaction-protocol.mdc`](.cursor/rules/interaction-protocol.mdc)）。

### AI 编程友好的「低代码」Agent 空间

平台愿景之一：**用声明式 spec 搭出 Agent 空间**，把「场景＋NPC＋对话流＋部分引擎机制」从大量手写胶水代码中抽出来，方便人类与 AI 结对迭代——多数扩展只需 YAML 与本体 JSON 配置，无需改 TS（边界见 [`docs/lowcode-guide.md`](docs/lowcode-guide.md)）：

- **场景**：`specs/scenes/*.yaml`，由 scene-loader **自动发现**（编写约定见 [`.cursor/rules/scene-plugin-guide.mdc`](.cursor/rules/scene-plugin-guide.mdc)）。
- **NPC**：`specs/npcs/*.yaml`，与场景、视觉配置、`platform-ontology.json` 等联动。
- **三层本体**（世界模型 / 运行机制 / 通信协议）：`platform-ontology.json`、`operational-ontology.json`、`communication-protocol.json`，变更需遵循跨层一致性（见 [`.cursor/rules/ontology-sync.mdc`](.cursor/rules/ontology-sync.mdc)）。
- **BehaviorSpec / SubFlow / DomainSpec** 等：在 `specs/` 下以 YAML 声明行为与人工空间侧声明式 CRD（架构索引见根目录 [`CLAUDE.md`](CLAUDE.md) 中「Engine 架构」与文档表）。

仓库内 [`CLAUDE.md`](CLAUDE.md) 把上述内容定位为 **「Agent 空间低代码平台」** 与双空间产品目标的第四层叙述，并与 `.cursor/rules` 中的引擎不变量、设计–代码同步门禁（[`design-code-sync.mdc`](.cursor/rules/design-code-sync.mdc)）一起，约束迭代时「文档与实现一致」。

### 对外复用：可复制的 Agent 低代码引擎

本项目的 **Agent 空间** 不是「硬编码几个页面」，而是一套**可带走的规格驱动（spec-driven）运行时**：别人可以 **Fork、裁剪、嵌入到自己的 A2A / PA 产品** 里，用 YAML/JSON 迭代场景与行为，把 TypeScript 留给真正的业务差异点。

**适合直接借鉴或拷贝的典型模块**（均在 **Apache-2.0** 下分发，见下文「开源许可」）：

| 能力 | 代码与配置（入口级） | 你能得到什么 |
|:---|:---|:---|
| 场景脚本与加载 | `specs/scenes/*.yaml`、`src/lib/engine/scene-loader.ts` | 声明式场景、`opening`/`actions`、自动发现与 Schema 校验 |
| NPC 与驻场逻辑 | `specs/npcs/*.yaml`、`src/lib/npc/` | NPC 规格、与本体联动的提示与回复管线 |
| 游戏循环与回合 | `src/lib/engine/game-loop.ts`、`session.ts`、`types.ts` | 四阶段循环、二元决策（REST/ACT、STAY/MOVE） |
| 本体与 FC 派发 | `src/lib/engine/platform-ontology.json`、`operational-ontology.json`、`communication-protocol.json`、`ontology.ts`、`fc-dispatcher.ts` | 三层本体、FunctionCall 注册表、可扩展派发 |
| 意图与对话安全 | `src/lib/engine/ai-classifier.ts`、`conversation-guard.ts` | 分类器降级、循环与越权类守卫 |
| 行为与 SubFlow | `src/lib/behavior-engine/`、`src/lib/component-runtime/`、`src/lib/subflow/`、`specs/behaviors/` | BehaviorSpec 多策略、`ComponentSpec` + 确认 UI 桥 |
| GM 编排与 API | `src/lib/gm/`、`src/app/api/gm/` | 对话链编排、与前端大厅/场景对接的 HTTP 边界 |
| 编写约束（给 Agent/人共用） | `.cursor/rules/*.mdc`（如 [`scene-plugin-guide.mdc`](.cursor/rules/scene-plugin-guide.mdc)、[`ontology-sync.mdc`](.cursor/rules/ontology-sync.mdc)） | 增删场景/NPC/FC 时的一致性清单，适合放进你自己的 CI 或 Copilot 规则 |

**集成时通常要自行替换的一层**（与本 demo 产品绑定，不属于「引擎内核」）：

- **身份与租户**：SecondMe OAuth、`SECONDME_*`（可换成任意 OAuth/OIDC）。
- **业务数据模型**：Prisma 里市场、圈子、排行、实践帖子等表——引擎侧会话多为内存 TTL，持久化策略按你的产品重接即可。
- **品牌与前端壳**：`src/app/lobby`、`src/components/scene/` 等 UI 可直接改皮肤或只保留 API。

**推荐给二次开发者的阅读顺序**：[`docs/lowcode-guide.md`](docs/lowcode-guide.md)（不写 TS 能做什么）→ [`docs/game-loop-architecture.md`](docs/game-loop-architecture.md) → [`docs/ontology-architecture.md`](docs/ontology-architecture.md) → 根目录 [`CLAUDE.md`](CLAUDE.md) 文档索引。

### 工程模板与底座

- **认证与 Next 底座**：子目录 [`secondme-auth-starter/`](secondme-auth-starter/) 提供 **Next.js 15（App Router）+ SecondMe OAuth 2.0** 的轻量模板说明（示例流为 Cookie 会话、零额外依赖）；本主项目在同一技术栈上扩展为**全栈门户 + Prisma 持久化 + Agent 引擎**。
- **协作规范**：对引擎 / 场景 / NPC / 本体的修改，以设计文档为理解权威、代码为行为表达；具体映射由 `npm run doc-sync` 与 [`design-code-sync.mdc`](.cursor/rules/design-code-sync.mdc) 校验。

## 功能概览

- **用户与身份**：通过 SecondMe OAuth2 登录；用户资料与会话由服务端会话管理。
- **内容与发现**：圈子（如互联网 / 游戏 / 实验向）、应用详情、讨论区入口、大厅与门户导航。
- **开发者**：开发者注册与应用设置、应用反馈聚合、实践（practices）相关页面。
- **运营与互动**：排行榜、名人堂、PA 目录与活动页、站内反馈入口、管理端（含周结算等 API）。
- **Agent 对接**：`/api/agent/*` 等路由需配置 `AGENT_API_KEY`。
- **国际化**：Web 文案通过 `next-intl` 维护（中 / 英等）。

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 15（App Router）、React 19、TypeScript |
| 数据 | Prisma 6、PostgreSQL |
| UI | Tailwind CSS |
| 可观测性 | Sentry（可选） |
| 测试 | Vitest |

要求 **Node.js ≥ 20**（见 `package.json` 的 `engines`）。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

`postinstall` 会执行 `prisma generate`。

### 2. 环境变量

复制示例文件并按环境填写：

```bash
cp .env.example .env.local
```

至少包含：

- **SecondMe OAuth**：`SECONDME_CLIENT_ID`、`SECONDME_CLIENT_SECRET`、`SECONDME_REDIRECT_URI`，以及 `SECONDME_*_URL` / token 端点（默认值见 `.env.example`）。
- **数据库**：`DATABASE_URL` 指向 **PostgreSQL**。当前 `prisma/schema.prisma` 的数据源为 `postgresql`，生产与本地开发均需提供可用的 Postgres 连接串。
- **Agent**：`AGENT_API_KEY`（随机强密钥，用于受保护的 Agent API）。
- **Sentry**（可选）：按需设置 `SENTRY_DSN` 等（见 `.env.example` 注释）。

### 3. 数据库迁移与种子数据

```bash
npx prisma migrate dev
npx prisma db seed
```

Seed 入口见 `package.json` 的 `prisma.seed`（当前为 `npx tsx prisma/seed.ts`）。

### 4. 开发服务器

```bash
npm run dev
```

默认 <http://localhost:3000>。登录跳转依赖你配置的 SecondMe OAuth 与回调 URL。

## 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 本地开发 |
| `npm run build` | `prisma generate` + Next 生产构建 |
| `npm run start` | 生产模式启动 |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript 检查 |
| `npm run test` | Vitest 单测 |
| `npm run doc-sync` | 对照 `.cursor/rules/design-code-sync.mdc` 做设计–代码映射校验 |
| `npm run ci` | 流水线式串跑：lint、typecheck、test、doc-sync、build |

## 仓库内文档与子项目

- **维护者首读**：[CLAUDE.md](CLAUDE.md)（产品四层定位、Human Space 路由、引擎与文档索引）。
- **对外叙事**：[docs/product-narrative.md](docs/product-narrative.md)、双空间：[docs/dual-space-architecture.md](docs/dual-space-architecture.md)、低代码：[docs/lowcode-guide.md](docs/lowcode-guide.md)。
- 部分研究/审计输出在 `docs/research/` 等目录。
- `secondme-auth-starter/`：SecondMe OAuth 模板（参见上文「工程模板与底座」）。

## 开源许可

- 本仓库采用 **[Apache License 2.0](LICENSE)**（宽松许可；含**明示专利授权**条款；**不**提供产品担保）。随仓库提供 **[NOTICE](NOTICE)**，再分发时若你修改了文件，请遵守协议中对变更说明、保留 NOTICE 等要求。
- `package.json` 中 `"private": true` 仅表示**不发布到 npm 注册表**，与 GitHub 开源并不冲突。
- 若你复用引擎代码，请在衍生项目中保留 `LICENSE`、按需保留或合并 `NOTICE`，并遵守各依赖包自身的许可证（见 `package-lock.json` / SPDX）。

---

**English summary:** A Next.js 15 app for the SecondMe A2A ecosystem (“A2A Market News”)—an app marketplace with **dual-space UX** (Human Space: web forms/dashboards; Agent Space: scene/NPC game loop with advisor/auto/direct modes), a **forkable, YAML-driven low-code engine** for Agent Space (scenes, NPCs, three-layer ontology, BehaviorSpec/SubFlow, GM pipeline)—**Apache-2.0-licensed** for reuse in other A2A/PA products—plus hackathon-oriented showcase features, Prisma/PostgreSQL, and SecondMe OAuth. Starter template: `secondme-auth-starter/`. Repo: [github.com/SYMlp/a2a-market-news](https://github.com/SYMlp/a2a-market-news).
