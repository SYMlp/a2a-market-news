# Research Plan: A2A Market News 当前系统架构评估

## 0. 调研简报摘要

**输入类型**: Type A（明确问题）— 用户要求评估当前系统架构并给出评价。

**核心意图**: 全面审视 a2a-market-news 项目当前的分层架构、模块边界、API 契约、数据流、耦合/内聚度、可扩展性、可观测性和可维护性，识别架构优势与风险，输出结构化评价报告。

**调研性质**: 探索类 + 评估类（内部代码审计，非外部搜索）

**策略**: 深度优先 — 系统已有详尽的设计文档体系，以文档为入口逐层深入代码验证。

## 1. 核心问题拆解

- **Q1: 分层架构实效** — 四层模型（L0-L3）+ 双空间（Dual-Space）的实际落地程度如何？层间依赖是否遵循了设计意图？是否存在越层调用？
- **Q2: 模块边界清晰度** — Human Space 6 领域 + Agent Space 引擎模块的边界是否干净？是否存在跨域逻辑泄漏（如 gamification 逻辑散落在 API route 中）？
- **Q3: API 契约一致性** — ~70 个 API route 是否遵循统一响应格式？auth 模式是否一致？错误处理是否标准化？
- **Q4: 数据流与副作用对齐** — 双空间对同一业务行为的副作用是否真正对齐？`source` 标记是否完整？数据流断裂点在哪里？
- **Q5: 耦合/内聚评估** — `src/lib/` 下 78 个文件的职责划分是否内聚？模块间依赖图是否存在环？是否有"上帝文件"（过度集中的逻辑）？
- **Q6: 可扩展性瓶颈** — 低代码引擎覆盖 Agent Space ~80%，Human Space 0%。新增功能的开发成本在两个空间中分别如何？
- **Q7: 可观测性** — 日志、监控、错误追踪的覆盖度。生产环境的问题定位能力如何？
- **Q8: 可维护性风险** — 设计文档与代码的同步程度。技术债务的集中区域。测试覆盖。

## 2. 调研路径（Execution Path）

### Phase 1: 设计文档审计（文档 vs 文档的一致性）

> 目标：验证设计文档体系自身的完整性和一致性，建立评估基准线。

- **Task 1.1**: 设计文档覆盖度检查
  - **Evidence Path**: `docs/*.md` 全部 30 个文档
  - **Focus**: 哪些系统子模块有设计文档、哪些没有？文档间引用关系是否完整？是否有孤立文档？
  - **Success Criteria**: 产出"设计文档覆盖矩阵"——列出每个代码模块对应的设计文档（或标记缺失）

- **Task 1.2**: 设计文档层级一致性
  - **Evidence Path**: `docs/system-architecture-overview.md`（D1）→ 各 D2 文档 → `docs/engine-invariants.md`（D3）
  - **Focus**: D1 文档的概念是否在 D2 中被正确展开？D3 的决策是否能追溯到 D1 原则？
  - **Success Criteria**: 标注每处层级断裂（D1 提到但 D2 未展开、D2 引用不存在的 D1 概念）

- **Task 1.3**: 本体架构（Ontology）一致性
  - **Evidence Path**: `docs/ontology-architecture.md`, `docs/system-ontology-manifest.yaml`, `src/lib/engine/ontology.ts`, 三层 ontology JSON 文件
  - **Focus**: manifest 中定义的 10 实体类型 + 14 边类型是否在代码中全部实现？ontology JSON 是否与 manifest 一致？
  - **Success Criteria**: 产出 ontology 实体覆盖率（已实现 / 已定义）

### Phase 2: 分层架构审计（设计 vs 代码）

> 目标：验证代码是否遵循了设计文档定义的分层架构。

- **Task 2.1**: 四层模型落地验证
  - **Evidence Path**: `src/lib/engine/session.ts`（L0）, `src/lib/gm/scenes.ts`（L1）, `src/lib/engine/session-context.ts`（L2）, `src/lib/engine/game-loop.ts`（L3）
  - **Focus**: 层间调用方向是否单向（L0→L1→L2→L3）？是否存在 L3 直接调用 L0 的越层引用？
  - **Success Criteria**: 产出层间依赖图，标注每处越层调用

- **Task 2.2**: 双空间隔离度
  - **Evidence Path**: `src/app/api/gm/` 目录（Agent Space API 入口）vs `src/app/api/` 其他目录（Human Space API）, `src/lib/` 下的共享模块
  - **Focus**: Agent Space 的代码是否引用了 Human Space 的模块？反过来呢？共享层（如 `prisma.ts`, `auth.ts`）是否保持中立？
  - **Success Criteria**: 产出双空间依赖矩阵

- **Task 2.3**: GM 编排层职责边界
  - **Evidence Path**: `src/lib/gm/engine.ts`, `src/app/api/gm/process/route.ts`, `docs/gm-orchestration-architecture.md`
  - **Focus**: GM 是否真正是 Agent Space 的唯一编排者？route 层是否泄漏了编排逻辑？
  - **Success Criteria**: 确认 GM facade 边界是否干净

### Phase 3: 模块边界与内聚度审计

> 目标：评估每个模块的内聚度和模块间耦合度。

- **Task 3.1**: Human Space 6 领域边界验证
  - **Evidence Path**: `docs/human-space-domain-map.md` 的领域定义 vs 实际 API route 和 lib 文件
  - **Focus**: 逻辑是否真的在"归属领域"中？是否有跨域函数调用？"Logic is inline in API routes" 标注的 3 个领域（Community, Practices, PA Directory）的代码膨胀度
  - **Success Criteria**: 每个领域的内聚度评分（High/Medium/Low）+ 跨域调用清单

- **Task 3.2**: Agent Space 模块依赖图
  - **Evidence Path**: `src/lib/engine/`, `src/lib/gm/`, `src/lib/npc/`, `src/lib/scenes/`, `src/lib/behavior-engine/`, `src/lib/component-runtime/`, `src/lib/subflow/`, `src/lib/pa/`
  - **Focus**: import 关系图。是否有循环依赖？哪些模块是"连接器"（被多方依赖）？
  - **Success Criteria**: 依赖图 + 环检测 + 扇入/扇出最高的模块清单

- **Task 3.3**: 共享工具层（`src/lib/` 根）审计
  - **Evidence Path**: `src/lib/prisma.ts`, `src/lib/auth.ts`, `src/lib/api-utils.ts`, `src/lib/model-config.ts`, `src/lib/json-utils.ts`, `src/lib/fetch-timeout.ts`, `src/lib/notification.ts`, `src/lib/feedback-schema.ts`, `src/lib/prompt-loader.ts`, `src/lib/mcp-auth.ts`, `src/lib/agent-auth.ts`
  - **Focus**: 哪些是真正的"基础设施"工具、哪些实际是领域逻辑？是否有应该下沉到领域目录的文件？
  - **Success Criteria**: 分类表（infra / domain / misplaced）

### Phase 4: API 契约一致性审计

> 目标：验证 ~70 个 API route 是否遵循统一契约。

- **Task 4.1**: 响应格式一致性
  - **Evidence Path**: 采样 15-20 个 API route（每个领域 2-3 个 + Agent Space 入口）
  - **Focus**: 是否都返回 `{ success: true, data }` / `{ error }` 格式？HTTP status 是否一致？
  - **Success Criteria**: 合规率（N/M routes 遵循契约）+ 偏离清单

- **Task 4.2**: Auth 模式一致性
  - **Evidence Path**: grep `requireAuth` 在所有 route 中的使用
  - **Focus**: 需要 auth 的 route 是否都用了 `requireAuth()`？是否有 route 自行实现 auth 逻辑？
  - **Success Criteria**: Auth 模式分类表

- **Task 4.3**: 错误处理一致性
  - **Evidence Path**: 采样 route 的 try-catch 模式
  - **Focus**: 是否有统一的错误处理中间件？还是每个 route 各自 try-catch？错误信息是否 i18n 一致（中文）？
  - **Success Criteria**: 错误处理模式分类 + 改进建议

### Phase 5: 数据流与副作用审计

> 目标：追踪核心数据从产生到消费的完整路径，验证双空间对齐。

- **Task 5.1**: AppFeedback 数据流端到端追踪
  - **Evidence Path**: `src/lib/component-runtime/handler-registry.ts`（Agent Space 写入）, `src/app/api/pa-action/review/route.ts`（Human Space 写入）, `src/app/api/my-reviews/route.ts`（读取）, `src/lib/gamification/reward-pipeline.ts`（副作用）
  - **Focus**: 两条写入路径的副作用是否真正对齐？`rewardReview()` 是否被两条路径都调用？
  - **Success Criteria**: 数据流图 + 对齐/不对齐标注

- **Task 5.2**: Prisma Schema 与代码使用一致性
  - **Evidence Path**: `prisma/schema.prisma` vs 代码中的 `prisma.xxx.findMany/create/update` 调用
  - **Focus**: Schema 中定义的模型是否都被使用？是否有代码操作了 Schema 中不存在的字段？
  - **Success Criteria**: 模型使用覆盖率

- **Task 5.3**: Session 状态管理一致性
  - **Evidence Path**: `src/lib/engine/session.ts`, `src/lib/engine/session-context.ts`, grep `session.flags` / `session.data`
  - **Focus**: session 状态变更是否都通过 `session-context.ts`？还是有 route 直接修改 session？
  - **Success Criteria**: 状态变更路径清单（规范 vs 非规范）

### Phase 6: 可扩展性、可观测性与可维护性

> 目标：评估系统的长期健康度。

- **Task 6.1**: 低代码覆盖度评估
  - **Evidence Path**: YAML spec 文件（`specs/`）, `src/lib/component-runtime/`, `docs/lowcode-guide.md`
  - **Focus**: Agent Space 的 YAML-driven 模式覆盖了哪些场景？Human Space 的哪些模式可以从 YAML 化中受益？
  - **Success Criteria**: 低代码覆盖矩阵（Agent Space 各子系统 + Human Space 各领域）

- **Task 6.2**: 可观测性评估
  - **Evidence Path**: `src/lib/engine/event-logger.ts`, grep `console.log` / `console.error`, 检查是否有结构化日志
  - **Focus**: 日志是否有结构化（JSON / 带 context）？是否有请求追踪 ID？生产环境如何排障？
  - **Success Criteria**: 可观测性评分（日志覆盖 / 结构化程度 / 追踪能力）

- **Task 6.3**: 测试覆盖度
  - **Evidence Path**: 所有 `*.test.ts` 文件, `package.json` 的 test scripts
  - **Focus**: 哪些模块有测试？覆盖率如何？关键路径（auth, gamification, game loop）是否被测试？
  - **Success Criteria**: 测试覆盖矩阵

- **Task 6.4**: 技术债务盘点
  - **Evidence Path**: git status（未提交的变更）, 设计文档中标记的 "gap" / "TODO" / "未实现", `docs/engine-invariants.md` 中的已知妥协
  - **Focus**: 有哪些已识别但未解决的技术债务？哪些 debt 会阻碍后续功能开发？
  - **Success Criteria**: 技术债务清单（按优先级排序）

- **Task 6.5**: 设计文档 vs 代码同步度
  - **Evidence Path**: 选择 3-5 个核心设计文档，与对应代码交叉比对
  - **Focus**: 文档描述的接口签名、数据流、状态机是否与代码一致？最后修改时间差异
  - **Success Criteria**: 同步度评分 + 不同步清单

## 3. 预期产物结构

最终报告 `docs/research/current-system-architecture-evaluation/report.md` 应包含：

### 3.1 执行摘要
一页纸总结：系统成熟度评级、关键优势、关键风险、优先行动建议。

### 3.2 分维度评价

| 评估维度 | 评级 | 证据摘要 |
|:---|:---|:---|
| 分层架构实效 | A/B/C/D | ... |
| 模块边界清晰度 | A/B/C/D | ... |
| API 契约一致性 | A/B/C/D | ... |
| 数据流完整性 | A/B/C/D | ... |
| 耦合/内聚度 | A/B/C/D | ... |
| 可扩展性 | A/B/C/D | ... |
| 可观测性 | A/B/C/D | ... |
| 可维护性 | A/B/C/D | ... |

### 3.3 架构优势清单
具体列出做得好的地方（设计文档体系、ontology 驱动、低代码引擎等）。

### 3.4 风险与技术债务清单
按影响级别排序的风险列表，每项含：描述、证据、影响范围、建议修复优先级。

### 3.5 改进路线图建议
分短期（1-2 周）、中期（1-2 月）、长期的改进建议。

## 4. 执行策略

- **执行模式**: 全部为内部代码审计，不需要外部搜索
- **证据收集**: 每个 Task 的发现写入 `notes/` 目录，命名 `{phase}-{task}.md`
- **工具使用**: 主要用 Read（读文档/代码）+ Grep（搜索模式）+ Glob（定位文件），不需要 WebSearch/WebFetch
- **任务依赖**: Phase 1 → Phase 2（设计基准线先建立）→ Phase 3-5 可并行 → Phase 6 最后（需前面所有发现作为输入）
