# Deep Research Report: A2A Market News 当前系统架构评估

**调研计划**: `docs/research/current-system-architecture-evaluation/plan.md`  
**执行日期**: 2026-03-21  
**执行模式**: 内部代码审计（无外部搜索）

---

## 1. Executive Summary

A2A Market News 项目采用四层模型（L0–L3）、双空间（Human Space / Agent Space）和三层 Ontology 驱动的设计，整体架构成熟度处于**中上水平**。设计文档体系完整，约 26 个设计文档覆盖了大部分核心模块；Ontology 实体与边类型实现率达 100%；双空间对 AppFeedback 的副作用通过 `rewardReview()` 实现了对齐。GM 编排层职责边界清晰，route 层保持薄层，编排逻辑集中在 `gm/engine`。

主要风险集中在三处：**L3→L0 越层调用**（`game-loop` 和 `conversation-guard` 直接调用 `session.persistSession`）、**Human Space 领域内聚度偏低**（Community、Practices、PA Directory 逻辑全 inline）、以及**可观测性与测试覆盖不足**（无请求追踪 ID，gm/gamification/pa-actions 无测试）。短期建议优先修复越层调用，中期补齐 Human Space 领域 lib 化与可观测性，长期推进 BehaviorSpec 实现与 V1 兼容层迁移。

---

## 2. Key Findings

### 2.1 设计文档与 Ontology 体系

**设计文档覆盖度**：约 26 个 `.md` 文档（不含 research 子目录）及 `system-ontology-manifest.yaml`，覆盖 D1–D3 层级。核心模块如 engine、gm、npc、scenes、component-runtime、gamification、pa-actions 均有对应设计文档（见 `notes/1-1-design-doc-coverage.md`）。

| 模块 | 设计文档 | 状态 |
|:---|:---|:---|
| engine, gm, npc, scenes | game-loop, gm-orchestration, ontology-architecture | ✅ 覆盖 |
| component-runtime, subflow, pa | component-spec, pa-lifecycle | ✅ 覆盖 |
| gamification, pa-actions | human-space-domain-map | ✅ 覆盖 |
| behavior-engine | behavior-spec-architecture | ⚠️ 设计中，未实现 |
| registration | - | ❌ 无独立设计文档 |

**文档层级一致性**：D1 的 L0–L3 概念在 D2 中有对应展开，D3 的 engine-invariants 可追溯到 game-loop-architecture。存在**命名空间重叠**：game-loop 中的 L1/L2（PlayerTurn/TurnOutcome）与架构层的 L1/L2 含义不同，易混淆（`notes/1-2-design-doc-hierarchy.md`）。

**Ontology 一致性**：Manifest 定义的 10 实体类型、14 边类型在代码中均有实现；`ontology.ts` 正确加载三层 JSON 并导出 `getOntology`、`getOperationalOntology`、`getCommunicationProtocol`。覆盖率 100%（`notes/1-3-ontology-consistency.md`，原始证据 `raw/task-1-3-ontology-coverage.md`）。

---

### 2.2 分层架构与越层调用

**四层模型落地**：L0（session.ts）、L1（scenes/registry）、L2（session-context）、L3（game-loop）代码映射正确。session-context（L2）→ session（L0）为合理调用（L2 可调用 L0 持久化）。

**越层调用清单**（`notes/2-1-four-layer-verification.md`，`raw/task-2-1-layer-deps.md`）：

| 调用方 | 被调用方 | 函数 |
|:---|:---|:---|
| game-loop (L3) | session (L0) | persistSession |
| conversation-guard | session (L0) | persistSession |

层间依赖示意：

```
L0 session.ts ←── session-context (L2)
     ↑              ↑
     |              |
     +──────────────+── game-loop (L3)
     |
     +── conversation-guard
```

---

### 2.3 双空间隔离与 GM 编排边界

**双空间依赖**：Agent Space 的 `handler-registry` 调用 `gamification.rewardReview`，符合设计意图——双空间副作用对齐（AppFeedback 写入后统一奖励）。gm/pa-respond 调用 pa-actions.callSecondMeStream（PA 顾问模式），合理。Human Space API 不直接调用 gm（`notes/2-2-dual-space-isolation.md`）。

**GM 编排层**：`process/route.ts` 为薄路由层，仅做 body 解析与分支分发，编排逻辑全部委托 `gm/engine`。Route 不直接操作 `session.flags`，通过 session-context 和 engine 完成。GM facade 边界清晰（`notes/2-3-gm-orchestration-boundary.md`）。

---

### 2.4 Human Space 领域内聚度与共享层

**领域内聚度**（`notes/3-1-human-space-domains.md`）：

| 领域 | 内聚度 | 说明 |
|:---|:---|:---|
| Gamification | High | 独立 lib，API 薄 |
| PA Actions | High | pa-actions + gamification |
| Developer | Medium | notification.ts，其余 inline |
| Community | Low | 全 inline |
| Practices | Low | 全 inline |
| PA Directory | Low | 全 inline，依赖 gamification 数据 |

**跨域调用**：gamification.reward-pipeline → pa-actions.logPAAction；pa-action routes → gamification（addPoints, rewardReview, incrementDailyTask）；pa-directory → AchievementUnlock（Prisma 模型，非 lib）。

**共享 lib 审计**（`notes/3-3-shared-lib-audit.md`）：`notification` 建议移至 `src/lib/developer/` 或标注领域归属；`feedback-schema` 属于 PA Actions 领域。

---

### 2.5 Agent Space 模块依赖

engine 为枢纽，被 gm、npc、component-runtime、behavior-engine、subflow、pa 依赖；未检测到循环依赖。component-runtime 同时依赖 engine、gm、gamification，承担双空间桥接。扇入最高：engine/types、engine/session（`notes/3-2-agent-module-deps.md`）。

---

### 2.6 API 契约与数据流

**API 契约**（`notes/4-api-contract.md`）：多数 Human Space API 使用 apiSuccess/apiError/apiPaginated 或等效格式；pa-directory 使用自定义 pagination 结构，合规率约 90%。Auth 模式：`requireAuth()` 与 `getCurrentUser + if (!user) 401` 并存，均能达到认证目的。无统一错误处理中间件，各 route 自行 try-catch。

**AppFeedback 数据流**（`notes/5-dataflow.md`，`raw/task-5-dataflow.md`）：

| 路径 | 写入 | 副作用 |
|:---|:---|:---|
| Agent (fc.saveReport) | AppFeedback source=gm_report | rewardReview ✅ |
| Human (pa-action/review) | AppFeedback source=pa_action | rewardReview ✅ |

两条路径均调用 `rewardReview`，副作用对齐。Session 状态变更通过 session-context 提供的函数完成，Route 层未发现直接写 `session.flags` 的情况。

---

### 2.7 可扩展性、可观测性与可维护性

**低代码覆盖**（`notes/6-ext-obs-maint.md`）：

| 子系统 | YAML/Spec 驱动 | 覆盖度 |
|:---|:---|:---|
| Agent Space 场景 | specs/scenes/*.yaml | ✅ |
| Agent Space NPC | specs/npcs/*.yaml | ✅ |
| Agent Space SubFlow | specs/component-specs/*.yaml | ✅ |
| Agent Space FC 分发 | operational-ontology.json | ✅ |
| Human Space | - | 0% |

**可观测性**：event-logger 写入 game_session_logs、game_turn_logs；无请求追踪 ID，无统一 JSON 结构化日志。评分：中。

**测试覆盖**：developer/*、agent/feedback 有测试；gm/process、game-loop、gamification、pa-actions、session-context 无测试。

**技术债务**：GM 主动编排、多 PA 同场（system-architecture）；BehaviorSpec 未实现；V1 compat 迁移策略未定义（plan-completion-gate）。

---

## 3. Analysis & Implications

### 3.1 架构优势

1. **设计文档体系完整**：D1–D3 层级清晰，文档间引用关系完整，为代码审计和新人上手提供良好基准。
2. **Ontology 驱动**：三层 Ontology 与 manifest 一致，实体与边类型实现率 100%，支撑 Agent 认知与 FC 分发。
3. **双空间副作用对齐**：AppFeedback 两条写入路径均调用 rewardReview，避免双空间行为不一致。
4. **GM 编排边界清晰**：Route 薄层，编排逻辑集中在 gm/engine，职责划分合理。
5. **Agent Space 低代码覆盖高**：场景、NPC、SubFlow、FC 均由 YAML/JSON 驱动，扩展成本低。

### 3.2 风险与技术债务

| 风险 | 影响 | 证据 |
|:---|:---|:---|
| L3→L0 越层调用 | 分层模型被破坏，后续演进易引入更多越层 | `raw/task-2-1-layer-deps.md` |
| Human Space 领域 inline 化 | Community/Practices/PA Directory 逻辑膨胀，难以复用与测试 | `notes/3-1-human-space-domains.md` |
| 无请求追踪 ID | 生产排障困难，无法关联跨请求日志 | `notes/6-ext-obs-maint.md` |
| 关键路径无测试 | gm、gamification、pa-actions 变更风险高 | `notes/6-ext-obs-maint.md` |
| BehaviorSpec 未实现 | 行为维度声明式抽象缺失 | `notes/1-1-design-doc-coverage.md` |
| V1 compat 迁移未定义 | 技术债务累积，迁移成本不确定 | plan-completion-gate |

### 3.3 分维度评价

| 评估维度 | 评级 | 证据摘要 |
|:---|:---|:---|
| 分层架构实效 | B | 四层映射正确，存在 L3→L0 越层 |
| 模块边界清晰度 | B | Agent Space 清晰，Human Space 3 领域 inline |
| API 契约一致性 | B | 约 90% 合规，pa-directory 分页格式偏离 |
| 数据流完整性 | A | AppFeedback 双路径对齐，Session 变更规范 |
| 耦合/内聚度 | B | engine 枢纽合理，Human Space 内聚度偏低 |
| 可扩展性 | B | Agent Space 低代码覆盖高，Human Space 0% |
| 可观测性 | C | 有 event-logger，缺追踪与结构化日志 |
| 可维护性 | B | 文档同步度高，测试覆盖不足 |

---

## 4. Actionable Recommendations

### 4.1 短期（1–2 周）

1. **消除 L3→L0 越层调用**  
   - 将 `persistSession` 的调用从 game-loop、conversation-guard 迁移至 session-context（L2），由 L2 统一负责持久化触发。  
   - 证据：`raw/task-2-1-layer-deps.md`。

2. **统一 API 分页格式**  
   - 将 pa-directory 的 pagination 结构对齐 apiPaginated 的 total/page 约定。  
   - 证据：`notes/4-api-contract.md`。

3. **引入请求追踪 ID**  
   - 在 API 入口生成或透传 `x-request-id`，写入 event-logger 与错误日志。  
   - 证据：`notes/6-ext-obs-maint.md`。

### 4.2 中期（1–2 月）

4. **Human Space 领域 lib 化**  
   - 将 Community、Practices、PA Directory 的核心逻辑抽取至 `src/lib/community/`、`src/lib/practices/`、`src/lib/pa-directory/`，API route 保持薄层。  
   - 证据：`notes/3-1-human-space-domains.md`。

5. **notification 归属明确化**  
   - 将 `notification.ts` 移至 `src/lib/developer/` 或标注领域归属。  
   - 证据：`notes/3-3-shared-lib-audit.md`。

6. **补齐关键路径测试**  
   - 为 gm/process、gamification、pa-actions、session-context 增加单元/集成测试。  
   - 证据：`notes/6-ext-obs-maint.md`。

### 4.3 长期

7. **BehaviorSpec 实现**  
   - 按 behavior-spec-architecture 推进行为维度声明式抽象。  
   - 证据：`notes/1-1-design-doc-coverage.md`。

8. **V1 compat 迁移策略**  
   - 在 game-loop-architecture 或独立文档中定义 @deprecated 类型与 V1 兼容层的迁移路径。  
   - 证据：plan-completion-gate。

9. **Human Space 低代码探索**  
   - 评估 Practices、PA Directory 等场景是否可从 YAML 化中受益。  
   - 证据：`notes/6-ext-obs-maint.md`。

---

## 5. References

| 来源 | 路径 |
|:---|:---|
| 执行摘要 | `notes/execution-summary.md` |
| 设计文档覆盖 | `notes/1-1-design-doc-coverage.md`，`raw/task-1-1-docs-inventory.md` |
| 文档层级 | `notes/1-2-design-doc-hierarchy.md`，`raw/task-1-2-hierarchy-trace.md` |
| Ontology 一致性 | `notes/1-3-ontology-consistency.md`，`raw/task-1-3-ontology-coverage.md` |
| 四层依赖 | `notes/2-1-four-layer-verification.md`，`raw/task-2-1-layer-deps.md` |
| 双空间隔离 | `notes/2-2-dual-space-isolation.md`，`raw/task-2-2-dual-space-deps.md` |
| GM 编排 | `notes/2-3-gm-orchestration-boundary.md` |
| Human Space 领域 | `notes/3-1-human-space-domains.md`，`raw/task-3-1-domain-boundaries.md` |
| Agent 模块依赖 | `notes/3-2-agent-module-deps.md`，`raw/task-3-2-agent-deps.md` |
| 共享 lib | `notes/3-3-shared-lib-audit.md`，`raw/task-3-3-shared-lib-audit.md` |
| API 契约 | `notes/4-api-contract.md`，`raw/task-4-api-contract.md` |
| 数据流 | `notes/5-dataflow.md`，`raw/task-5-dataflow.md` |
| 可扩展性/可观测性 | `notes/6-ext-obs-maint.md`，`raw/task-6-ext-obs-maint.md` |
| 调研计划 | `plan.md` |
