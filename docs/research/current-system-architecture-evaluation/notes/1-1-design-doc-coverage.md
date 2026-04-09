## 调研笔记：Task 1.1 设计文档覆盖度检查

**来源数量**: docs/*.md 全量扫描, human-space-domain-map, system-architecture-overview
**时间**: 2026-03-21

### 核心发现

- **设计文档总数**: 约 26 个 .md（不含 research 子目录），另有 system-ontology-manifest.yaml
- **D1 文档**: system-architecture-overview, dual-space-architecture, ontology-architecture, behavior-spec-architecture（设计中）
- **D2 文档**: human-space-domain-map, pa-lifecycle, gm-orchestration, game-loop, script-engine-spec, component-spec, scene-layout, event-logging
- **D3 文档**: engine-invariants, lowcode-guide, model-selection

### 设计文档覆盖矩阵

| 代码模块 | 设计文档 | 覆盖状态 |
|:---|:---|:---|
| src/lib/engine/ | game-loop-architecture, pa-lifecycle, ontology-architecture | ✅ 覆盖 |
| src/lib/gm/ | gm-orchestration-architecture | ✅ 覆盖 |
| src/lib/npc/ | gm-orchestration §4, engine-invariants | ✅ 覆盖 |
| src/lib/scenes/ | script-engine-spec | ✅ 覆盖 |
| src/lib/behavior-engine/ | behavior-spec-architecture | ⚠️ 设计中，未实现 |
| src/lib/component-runtime/ | component-spec-architecture | ✅ 覆盖 |
| src/lib/subflow/ | pa-lifecycle §9 | ✅ 覆盖 |
| src/lib/pa/ | pa-lifecycle §11 | ✅ 覆盖 |
| src/lib/gamification/ | human-space-domain-map §4 | ✅ 覆盖 |
| src/lib/pa-actions/ | human-space-domain-map §5 | ✅ 覆盖 |
| src/lib/registration/ | (extract, validate) | ❌ 无独立设计文档 |
| src/lib/ux/ | scene-layout, visual-conventions | ⚠️ 部分覆盖 |
| src/lib/scene-visuals/ | scene-layout | ✅ 覆盖 |

### 文档引用关系

- system-architecture-overview → pa-lifecycle, engine-invariants, game-loop, DESIGN-V2
- dual-space-architecture → system-architecture, product-narrative, human-space-domain-map, game-loop, gm-orchestration
- gm-orchestration → game-loop, script-engine, ontology, pa-lifecycle, engine-invariants, event-logging
- ontology-architecture → game-loop, pa-lifecycle, engine-invariants, script-engine, behavior-spec, ontology-sync.mdc

### 孤立/边缘文档

- docs/ontology.md — 可能与 ontology-architecture 重叠，需确认是否 legacy
- docs/API.md, docs/SOCIAL_FEATURES.md, docs/ADVANCED_FEATURES.md — 可能为旧版或补充说明

### 本地文件索引

- 原始清单: `raw/task-1-1-docs-inventory.md`
