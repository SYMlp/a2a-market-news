# Task 2.1 Raw: Four-Layer Import Dependencies

## Code mapping to layers

- L0: src/lib/engine/session.ts (createSession, getSession, persistSession, endSession)
- L1: src/lib/scenes/registry.ts + scene-loader.ts (getScene, scene graph)
- L2: src/lib/engine/session-context.ts (buildSessionContext, checkPrecondition, flags)
- L3: src/lib/engine/game-loop.ts (presentScene, resolveTurn, applyResult)

## Import graph (engine/)

session.ts: types only (no outgoing to L1-L3)
session-context.ts: ontology, session (persistSession), precondition-eval, behavior-engine
game-loop.ts: types, getScene (@/lib/scenes), template, match, session-context, ontology, session (persistSession), conversation-guard, behavior-engine

## Cross-layer calls

| From | To | Type |
|------|-----|------|
| game-loop (L3) | session (L0) | persistSession — **越层 L3→L0** |
| game-loop (L3) | session-context (L2) | checkPrecondition, clearSceneScopedFlags, getReturnContext |
| game-loop (L3) | scenes (L1) | getScene |
| session-context (L2) | session (L0) | persistSession — L2→L0 (allowed: L2 may call L0) |
| conversation-guard | session (L0) | persistSession |

## Route layer

api/gm/process/route.ts:
- gm/engine (facade)
- engine/session (endSession)
- engine/session-context (recordEvent, setReturnContext, etc.)
- engine/conversation-guard
- gm/function-call-executor
- engine/event-logger
- engine/ontology
- gm/route-utils

Route does not directly call session.ts create/get—those go through gm/engine.
