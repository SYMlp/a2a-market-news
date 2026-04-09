# Game Loop Architecture

## §1 Overview

The GM engine uses a **4-stage game loop** with a **binary decision model**:

- **L1**: REST | ACT (what the player decides)
- **L2** (ACT only): STAY | MOVE (what happens after ACT)

Every player input resolves to exactly one leaf. No third option exists at either level.

---

## §2 Four Stages

| Stage | Function | Responsibility |
|:------|:---------|:----------------|
| **PRESENT** | `presentScene` | Show scene opening + available actions |
| **AWAIT** | `extractTurn` | Wait for player input, classify as REST or ACT |
| **RESOLVE** | `resolveTurn` | Determine outcome: STAY (effect) or MOVE (transition) |
| **APPLY** | `applyResult` | Update session state + return response |

`processTurn` is the only entry point that chains all four. Never skip a stage. Never reorder.

---

## §3 Type Interfaces

### DualText

All user-facing text uses `DualText { pa: string; agent: string }`:

- `pa` — natural Chinese text for player display
- `agent` — structured English text for API/machine consumers

Never collapse DualText to a plain string.

### PlayerTurn (L1)

```ts
type PlayerTurn =
  | { type: 'rest'; seconds: number }
  | { type: 'act'; actionId: string; params?: Record<string, unknown> }
```

### TurnOutcome (L2)

```ts
type TurnOutcome = TurnOutcomeStay | TurnOutcomeMove

interface TurnOutcomeStay {
  type: 'stay'
  effect: SceneEffect
  message: DualText
}

interface TurnOutcomeMove {
  type: 'move'
  target: string
  transitionType: TransitionType  // 'enter_space' | 'sub_flow' | 'external'
  message: DualText
}

interface SceneEffect {
  dataUpdate?: Record<string, unknown>
  functionCall: FunctionCall
  refreshData?: boolean
}
```

### ScenePresentation

```ts
interface ScenePresentation {
  sceneId: string
  opening: DualText
  actions: ActionSlot[]
  meta: MetaActionType[]  // 'rest' | 'back' | 'help'
  data?: Record<string, unknown>
}
```

### TurnResponse

```ts
interface TurnResponse {
  sessionId: string
  scene: { id: string; label: DualText }
  message: DualText
  actions: ActionSlot[]
  meta: MetaActionType[]
  outcome?: { type: 'stay' | 'move'; functionCall?: FunctionCall; transition?: { from: string; to: string } }
  data?: Record<string, unknown>
  delay?: number
}
```

---

## §4 RESOLVE Pseudocode

`resolveTurn(session, turn)` has five branches:

```
1. REST
   if turn.type === 'rest':
     return TurnOutcomeStay {
       effect: { functionCall: GM.rest, refreshData: true }
       message: "休息一下，{seconds}秒后看看有什么新动态。"
     }

2. _back (meta action)
   if turn.actionId === '_back':
     return TurnOutcomeMove { target: 'lobby', transitionType: 'enter_space' }

3. _help (meta action)
   if turn.actionId === '_help':
     return TurnOutcomeStay {
       effect: { functionCall: GM.help }
       message: fillTemplate(scene.opening.first, session.data)
     }

4. action matched
   action = scene.actions.find(a => a.id === turn.actionId)
   if action:
     message = action.response ? fillTemplate(action.response) : default
     if action.outcome === 'stay':
       return TurnOutcomeStay { effect: { functionCall: action.functionCall, refreshData: true }, message }
     else:
       return TurnOutcomeMove { target: action.transition?.target || 'lobby', transitionType: action.transition?.type || 'enter_space', message }

5. fallback (no match)
   return TurnOutcomeStay {
     effect: { functionCall: GM.fallback }
     message: fillTemplate(scene.fallback.response, session.data)
   }
```

---

## §5 Session Model

`GameSession` tracks:

| Field | Type | Description |
|:------|:-----|:------------|
| `id` | string | Session identifier |
| `currentScene` | string | Current scene ID |
| `round` | number | Turns within current scene |
| `globalTurn` | number | Total turns across all scenes |
| `mode` | 'manual' \| 'auto' \| 'advisor' | Player input mode (synced on each request) |
| `agentId` | string? | PA agent ID |
| `agentName` | string? | PA display name |
| `data` | Record? | Scene-specific data |
| `flags` | SessionFlags? | Cross-scene and scene-scoped flags |
| `ended` | boolean? | Session ended |
| `endReason` | string? | `pa_leave` \| `loop_guard` \| `timeout` \| `navigator_exhausted` |
| `createdAt` | number | Timestamp |
| `lastActiveAt` | number | Last activity timestamp |

Sessions are ephemeral (in-memory Map with TTL). Never persist session state to database.

---

## §6 AI-Enhanced Wrappers

### enterSceneWithAI

- Calls `enterScene` for state update
- Builds `sessionContext` via `buildSessionContextForNPC`
- NPC system prompt automatically includes platform ontology (`serializeForNPC`) — no scene-specific branching needed
- Computes `isFirstVisit` from `visitedScenes` before `enterScene` updates it
- Calls `generateNPCReply` with `entryType: 'first' | 'return'` (replaces `isOpening`)
- Replaces `base.message` with AI-generated opening tailored to first/return context

Note: In v6, lobby had special handling (`buildNavigatorContext` injection + `buildContextualLobbyGreeting`). In v7, the ontology is injected for all scenes uniformly via the NPC engine.

### processMessageWithAI

- Classifies message via `classifyAction` (AI classifier)
- Resolves turn, applies result
- Does **NOT** generate NPC reply
- Returns `ProcessMessageResult` with `_turnMeta` (prevScene, isFreeChat, outcome, visitorInfo, originalMessage)
- Caller must execute FC, then call `generateNPCReplyForTurn()`

### generateNPCReplyForTurn

- Called **after** function call has executed
- Receives `fcResult` so NPC knows what actually happened
- Builds session context (including `fcResult`); NPC system prompt includes platform ontology
- Calls `generateNPCReply` with outcome and fcResult
- Handles conversation guard override (v7: scope redirect disabled, ontology handles scope in prompt)

---

## §7 FC Execution Separation

The engine separates **classification + resolve + apply** from **NPC reply generation**:

1. `processMessageWithAI` → classify, resolve, apply; return `ProcessMessageResult` with `functionCall` status `pending`
2. Route layer executes the function call
3. Route layer calls `generateNPCReplyForTurn(session, response, fcResult)` with actual FC result
4. NPC reply reflects what actually happened (executed / skipped / failed)

This ensures the NPC never describes an effect that did not occur.

---

## §8 Dialogue Chain Architecture

Every turn cycle is a pipeline of stages. The chain tail (Intent → GM → NPC) is shared by all modes. Only the chain head (Input + Formulation) varies per mode.

```
[Stage 0: Input] → [Stage 1: Formulate] → [Stage 2: Intent] → [Stage 3: GM] → [Stage 4: NPC]
 ↑ configurable      ↑ configurable         ↑ shared            ↑ shared        ↑ shared
```

**Blocking rule**: System waits for the first `blocking` participant in the chain. Everything after flows automatically.

| Role | Responsibility | Does NOT |
|:-----|:---------------|:---------|
| **Human** | Give advice to PA, or directly select actions | Speak to NPC directly (in advisor mode) |
| **PA** | Formulate responses, express intent in own style | Directly switch scenes |
| **NPC** | Respond within scope, guide visitors | Execute scene transitions |
| **GM** | Match actions, execute transitions, activate NPCs | Participate in dialogue content |

See `.cursor/rules/interaction-protocol.mdc` for mode configurations and transition protocol.

---

## §9 V1 Compatibility Layer

The following types are deprecated. Use the v2 equivalents instead.

| @deprecated | Use instead |
|:------------|:------------|
| `SceneOption` | `SceneAction` |
| `SceneTransition` | `TransitionType` |
| `GMSession` | `GameSession` |
| `GMResponse` | `TurnResponse` |

**Migration strategy**: Existing code paths (`enterScene`, `processMessage`) remain for backward compatibility. New flows should use `processTurn`, `enterSceneWithAI`, `processMessageWithAI`, and `generateNPCReplyForTurn`. V1 compat layer migration strategy is not yet fully defined.
