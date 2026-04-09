# Task 1.2 Raw: D1→D2→D3 Hierarchy Trace

## D1 concepts (system-architecture-overview)

- L0: System Entry/Exit, session create, TTL
- L1: GM Scene Graph, lobby⇄news, lobby⇄developer
- L2: PA_ENTER → PA_ACTIVE → PA_LEAVE
- L3: PRESENT → AWAIT → RESOLVE → APPLY

## D2 expansion check

| D1 Concept | D2 Doc | Expansion |
|------------|--------|-----------|
| L0 session | pa-lifecycle | Session context, flags, data |
| L1 scene graph | script-engine-spec | SceneAction, template, exits |
| L2 PA lifecycle | pa-lifecycle §2-6 | buildSessionContextForClassifier/NPC, precondition, return context |
| L3 game loop | game-loop-architecture | presentScene, resolveTurn, applyResult, 4 stages |
| GM orchestration | gm-orchestration | Facade, enterScene, processMessage, NPC pipeline |

## D3 trace to D1

| D3 Doc | Concept | D1 Origin |
|--------|---------|-----------|
| engine-invariants | PlayerTurn REST\|ACT | L3 binary decision (game-loop) |
| engine-invariants | TurnOutcome STAY\|MOVE | L3 binary decision |
| engine-invariants | DualText | L3 (game-loop) |
| engine-invariants | Spec-driven loaders | L1/L2 (scenes, ontology) |
| lowcode-guide | YAML specs | L1 scene, L2 SubFlow |

## Hierarchy breaks

- **DESIGN-V2.md**: D1 references it for "业务设计 + 对话链架构". File exists. No explicit D1→D2 trace in DESIGN-V2.
- **behavior-spec-architecture**: D1-level doc, marked "设计中，未实现". D2 (pa-lifecycle, component-spec) reference it. No D3 enforcement yet.
- **L1/L2 naming collision**: game-loop uses "L1" for PlayerTurn, "L2" for TurnOutcome. These are turn-level, not layer-level. Different namespace—acceptable but could confuse.
