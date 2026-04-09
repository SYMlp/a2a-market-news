# Task 1.1 Raw: Design Doc Inventory

## docs/*.md files (excluding research subdir)

| File | Purpose (from title/header) |
|------|-----------------------------|
| docs/system-architecture-overview.md | D1: Four-layer model (L0-L3) |
| docs/dual-space-architecture.md | D1: Cross-cutting dual space |
| docs/human-space-domain-map.md | D2: Human Space 6 domains |
| docs/product-narrative.md | Product intro |
| docs/product-pitch.md | External pitch |
| docs/scene-layout-architecture.md | D2: Scene layout |
| docs/pa-lifecycle-architecture.md | D2: PA lifecycle, SubFlow, ontology |
| docs/gm-orchestration-architecture.md | D2: GM facade, NPC, classifier |
| docs/event-logging.md | D2: Event logging |
| docs/ontology-architecture.md | D1: Three-layer ontology |
| docs/lowcode-guide.md | D3: Lowcode dev guide |
| docs/engine-invariants.md | D3: Invariants |
| docs/script-engine-spec.md | D2: Scene actions, templates |
| docs/behavior-spec-architecture.md | D1: BehaviorSpec (designing, not implemented) |
| docs/video-recording-script.md | Script |
| docs/component-spec-architecture.md | D2: ComponentSpec, SubFlow |
| docs/game-loop-architecture.md | D2: 4-stage loop |
| docs/model-selection.md | D3: Model selection |
| docs/DESIGN-V2.md | Business design |
| docs/secondme-oauth2-guide.md | OAuth guide |
| docs/secondme-openclaw-mcp-guide.md | MCP guide |
| docs/secondme-api-reference.md | API reference |
| docs/SOCIAL_FEATURES.md | Social features |
| docs/ADVANCED_FEATURES.md | Advanced features |
| docs/API.md | API |
| docs/ontology.md | Ontology (legacy?) |

## Code modules (src/lib) vs docs

| Module | Design Doc | Status |
|--------|------------|--------|
| src/lib/engine/ | game-loop-architecture, pa-lifecycle, ontology | Covered |
| src/lib/gm/ | gm-orchestration-architecture | Covered |
| src/lib/npc/ | gm-orchestration §4, engine-invariants | Covered |
| src/lib/scenes/ | script-engine-spec | Covered |
| src/lib/behavior-engine/ | behavior-spec-architecture (designing) | Partial |
| src/lib/component-runtime/ | component-spec-architecture | Covered |
| src/lib/subflow/ | pa-lifecycle §9 | Covered |
| src/lib/pa/ | pa-lifecycle §11 | Covered |
| src/lib/gamification/ | human-space-domain-map §4 | Covered |
| src/lib/pa-actions/ | human-space-domain-map §5 | Covered |
| src/lib/registration/ | (extract, validate) | No dedicated doc |
| src/lib/ux/ | scene-layout, visual-conventions | Partial |
| src/lib/scene-visuals/ | scene-layout | Covered |

## Reference graph (from grep)

- system-architecture-overview → pa-lifecycle, engine-invariants, game-loop, DESIGN-V2
- dual-space-architecture → system-architecture, product-narrative, human-space-domain-map, game-loop, gm-orchestration
- human-space-domain-map → dual-space
- gm-orchestration → game-loop, script-engine, ontology, pa-lifecycle, engine-invariants, event-logging
- ontology-architecture → game-loop, pa-lifecycle, engine-invariants, script-engine, behavior-spec, ontology-sync.mdc
- pa-lifecycle → component-spec, interaction-protocol.mdc, engine-invariants
