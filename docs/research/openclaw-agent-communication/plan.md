# Research Plan: OpenClaw Agent 沟通逻辑源码分析

## 0. 调研简报摘要

**核心意图**：深入 OpenClaw 源码，解析其 agent loop、对话管理、消息管线、角色系统、流式 UX 的实现细节，评估哪些设计模式可移植到 A2A 市场新闻平台（4-stage game loop + 三层本体架构）。

**策略**：深度优先。用户已有基础认知（自有系统架构成熟），需要源码级实现细节而非概念普及。

**已知资源**：
- 主仓库：`github.com/openclaw/openclaw`
- 架构分析：`github.com/botx-work/OpenClaw-Internals`（深度源码架构分析）
- 教程项目：`github.com/oujingzhou/build-your-own-openclaw`（12 章教程）
- 官方文档：`docs.openclaw.ai`

## 1. 核心问题拆解

- **Q1 — Agent Loop 架构**：主循环的控制流是什么？决策分支（tool call / direct reply / clarification）如何路由？与 LLM 的交互是单次还是多轮递归？
- **Q2 — 对话管理与上下文**：Memory 系统分几层？短期上下文如何裁剪？长期记忆用什么存储和检索？上下文窗口溢出时的降级策略？
- **Q3 — 消息处理管线**：从 IM 平台原始消息到 AI 回复再到平台发送，完整 pipeline 有几个阶段？中间件 / 插件如何注入？
- **Q4 — NPC/角色系统**：角色人格定义格式？system prompt 如何组装？多角色切换机制？角色一致性保障手段？
- **Q5 — 流式响应与 UX**：流式输出的技术实现（SSE / WebSocket / 其他）？打字效果、中间状态反馈、错误恢复？
- **Q6 — 与 A2A 系统对比**：OpenClaw 的 agent loop vs 4-stage game loop、OpenClaw 的角色系统 vs 三层本体（platform / operational / communication）、可借鉴 vs 不可直接套用的设计模式

## 2. 调研路径（Execution Path）

### Phase 1: 全局架构扫描（广度）

> 目标：建立 OpenClaw 整体架构的心智模型，定位后续深度分析的源码入口点。

- **Task 1.1**: 抓取 OpenClaw-Internals 架构分析
  - URL Fetch: `https://github.com/botx-work/OpenClaw-Internals`（README + 目录结构）
  - Focus: 模块分层图、核心数据流图、关键类/文件索引
  - Success Criteria: 能画出 OpenClaw 的模块依赖关系图，定位 agent loop、memory、message pipeline 的源码位置

- **Task 1.2**: 抓取 build-your-own-openclaw 教程目录
  - URL Fetch: `https://github.com/oujingzhou/build-your-own-openclaw`（README + 章节索引）
  - Focus: 12 章的主题列表，定位与 Q1-Q5 对应的章节
  - Success Criteria: 建立「问题 → 教程章节 → 源码文件」的映射表

- **Task 1.3**: 搜索 OpenClaw 官方架构文档
  - Query: `site:docs.openclaw.ai architecture OR "agent loop" OR runtime`
  - URL Fetch: `https://docs.openclaw.ai`（文档首页 + architecture 相关页面）
  - Focus: 官方对 agent runtime 的描述、配置项、扩展点
  - Success Criteria: 获取官方视角的架构描述，与社区分析交叉验证

- **Task 1.4**: 搜索 OpenClaw 主仓库结构
  - URL Fetch: `https://github.com/openclaw/openclaw`（README + 根目录结构）
  - Query: `OpenClaw source code structure monorepo packages`
  - Focus: 是否 monorepo？核心 package 分布？入口文件位置？
  - Success Criteria: 定位 `agent/`、`memory/`、`channel/`、`plugin/` 等关键目录

### Phase 2: 深度挖掘（按问题逐个攻破）

> 目标：针对 Q1-Q5 每个问题，从源码和分析文档中提取实现细节。

#### Task Group A: Agent Loop 架构（Q1）

- **Task 2.1**: Agent Loop 主循环源码分析
  - Query: `OpenClaw agent loop implementation source code main loop`
  - Query: `OpenClaw runtime agent execution flow decision branching`
  - Source: OpenClaw-Internals 的 agent/runtime 相关章节 + 主仓库对应源码
  - Focus: 主循环的 while/for 结构、LLM 调用点、tool call 分发逻辑、递归深度控制
  - Success Criteria: 能写出 agent loop 的伪代码，标注每个分支的条件和处理

- **Task 2.2**: 工具调用（Tool/Function Calling）流程
  - Query: `OpenClaw tool calling function calling plugin execution`
  - Source: 主仓库 + 教程中 plugin 相关章节
  - Focus: tool 注册机制、参数校验、执行沙箱、结果回注到对话流的方式
  - Success Criteria: 理解 tool call 从 LLM 输出到执行再到结果回注的完整链路

#### Task Group B: 对话管理与上下文（Q2）

- **Task 2.3**: Memory 系统架构
  - Query: `OpenClaw memory system context management conversation history`
  - Query: `OpenClaw long term memory short term memory RAG`
  - Source: OpenClaw-Internals memory 章节 + 主仓库 memory 相关代码
  - Focus: memory 层级划分（working / short-term / long-term）、存储后端、检索策略
  - Success Criteria: 能描述 memory 的读写时机和数据流向

- **Task 2.4**: 上下文窗口管理
  - Query: `OpenClaw context window token limit truncation strategy`
  - Source: 主仓库中 context/prompt 构建相关代码
  - Focus: token 计数方式、裁剪策略（FIFO / 重要性 / 摘要）、system prompt 保护
  - Success Criteria: 理解上下文溢出时的降级行为

#### Task Group C: 消息处理管线（Q3）

- **Task 2.5**: 消息 Pipeline 全流程
  - Query: `OpenClaw message pipeline middleware processing flow`
  - Query: `OpenClaw channel adapter message transformation`
  - Source: 教程 channels 章节 + 主仓库 channel/adapter 代码
  - Focus: 消息标准化（不同 IM 格式 → 统一格式）、中间件链、pre/post-processing hooks
  - Success Criteria: 能画出从「IM 平台 webhook」到「AI 回复发送」的完整流程图

- **Task 2.6**: 多平台适配层设计
  - Query: `OpenClaw multi-platform channel adapter design pattern`
  - Source: 主仓库 channel/ 目录结构 + 2-3 个具体 adapter 实现
  - Focus: adapter 接口定义、平台差异抹平策略、消息格式转换
  - Success Criteria: 理解 20+ 平台适配的设计模式

#### Task Group D: NPC/角色系统（Q4）

- **Task 2.7**: 角色/人格系统
  - Query: `OpenClaw character persona system prompt personality`
  - Query: `OpenClaw role play character consistency`
  - Source: 主仓库 persona/character 相关代码 + 文档
  - Focus: 角色定义格式（JSON / YAML / 自然语言）、system prompt 组装逻辑、角色切换机制
  - Success Criteria: 理解角色定义到 prompt 注入的完整链路

- **Task 2.8**: 角色一致性保障
  - Query: `OpenClaw character consistency guardrails response filtering`
  - Source: 主仓库中 prompt 构建和 response 后处理代码
  - Focus: 是否有 response 过滤/校正机制？角色偏移检测？多轮对话中的角色锚定策略？
  - Success Criteria: 总结保障角色一致性的技术手段清单

#### Task Group E: 流式响应与 UX（Q5）

- **Task 2.9**: 流式输出实现
  - Query: `OpenClaw streaming response SSE WebSocket real-time output`
  - Source: 主仓库 server/gateway 代码 + 教程 gateway 章节
  - Focus: 流式传输协议选择、chunk 分割策略、前端渲染逻辑
  - Success Criteria: 理解流式输出的技术栈和 chunk 粒度

- **Task 2.10**: UX 体感优化技术
  - Query: `OpenClaw typing indicator thinking status intermediate feedback`
  - Query: `OpenClaw user experience conversation flow response latency`
  - Source: 主仓库前端/客户端相关代码 + 社区讨论
  - Focus: 打字指示器、思考状态、错误重试、断线重连、部分结果展示
  - Success Criteria: 列出让对话体感好的具体技术手段清单

### Phase 3: 对比分析与可移植性评估（Q6）

> 目标：将 OpenClaw 的设计与 A2A 系统架构对比，产出可操作的借鉴建议。

- **Task 3.1**: 架构对比矩阵
  - 输入: Phase 2 全部笔记 + A2A 系统架构文档
  - 需读取:
    - `docs/game-loop-architecture.md`（4-stage game loop）
    - `docs/ontology-architecture.md`（三层本体）
    - `docs/script-engine-spec.md`（场景系统）
    - `docs/pa-lifecycle-architecture.md`（PA 生命周期）
    - `src/lib/engine/platform-ontology.json`
    - `src/lib/engine/operational-ontology.json`
  - Focus: 逐维度对比——循环模型、决策模型、上下文管理、角色系统、消息管线
  - Success Criteria: 产出对比矩阵表格，每维度标注「可直接借鉴 / 需适配 / 不适用」

- **Task 3.2**: 可移植设计模式提取
  - 输入: Task 3.1 对比矩阵
  - Focus: 从 OpenClaw 中提取可移植到 A2A 的设计模式，评估移植成本和收益
  - Success Criteria: 产出 3-5 个具体的「借鉴建议」，每个含：模式名称、OpenClaw 实现方式、A2A 适配方案、预估工作量

## 3. 预期产物结构

最终报告（`report.md`）应包含：

1. **架构全景**：OpenClaw 的模块分层图 + 核心数据流
2. **Agent Loop 深度解析**：主循环伪代码 + 决策分支图 + tool call 流程
3. **Memory 系统剖析**：层级架构 + 裁剪策略 + 存储后端
4. **消息管线全流程**：从 IM webhook 到 AI 回复的完整 pipeline 图
5. **角色系统设计**：角色定义格式 + prompt 组装 + 一致性保障
6. **UX 体感技术清单**：流式输出 + 中间状态 + 错误处理
7. **对比矩阵**：OpenClaw vs A2A 逐维度对比表
8. **借鉴建议**：3-5 个可移植设计模式 + 适配方案

## 4. 执行注意事项

- **源码优先**：优先从源码和架构分析文档中提取信息，泛泛的博客文章权重低
- **交叉验证**：官方文档 × 社区分析 × 教程项目 三方交叉验证关键结论
- **版本锚定**：记录分析时的 OpenClaw 版本（commit hash 或 release tag），因为 321K star 项目迭代快
- **持久化**：所有搜索结果存 `raw/`，抓取的网页存 `fetched/`，分析笔记存 `notes/`
