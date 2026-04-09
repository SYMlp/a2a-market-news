# GM Orchestration Architecture

## §1 Overview

The GM (Game Master) subsystem is the **orchestration layer** that ties the game loop core, NPC AI, scene management, and conversation safety into a unified request-response pipeline. It is the engine's public surface — the API route (`api/gm/process`) consumes GM-exported functions to drive the entire turn cycle.

### Relationship to Other Docs

| Concern | Primary doc | This doc covers |
|:--------|:-----------|:----------------|
| 4-stage game loop, types, session model | game-loop-architecture.md | How AI wrappers chain the stages |
| Scene definitions, SceneAction, template, keyword matching | script-engine-spec.md | How AI classifier replaces keyword matching |
| Three-layer ontology (platform, operational, communication) | ontology-architecture.md | How ontology is injected into NPC/classifier prompts |
| Session context, preconditions, SubFlow | pa-lifecycle-architecture.md | How context projection feeds AI layers |
| Structural invariants | engine-invariants.md | Conversation guard internals |

### Document Scope

This document covers:

1. **Facade structure** — why `lib/gm/` exists and what it aggregates
2. **API route orchestration** — the complete `POST /api/gm/process` flow
3. **NPC AI pipeline** — token management, prompt construction, LLM call, post-processing
4. **AI classifier pipeline** — cache → AI classification → keyword fallback
5. **Conversation guard system** — four detection modes with state management
6. **Cross-scene memory** — return context, PA goals, journey events
7. **Function call execution** — dispatch, SubFlow activation, side effects

---

## §2 Module Structure — Facade Pattern

`src/lib/gm/` is a **re-export facade** that aggregates multiple subsystem modules into a single import surface for consumers (primarily the API route).

```text
src/lib/gm/
├── engine.ts                → re-exports from @/lib/engine (game-loop, session)
├── types.ts                 → re-exports from @/lib/engine/types
├── npc-ai.ts                → re-exports from @/lib/npc (generateNPCReply, getNPCForScene)
├── npc-prompts.ts           → re-exports from @/lib/npc (buildNPCMessage)
├── scenes.ts                → re-exports from @/lib/scenes (getScene, SCENES)
├── scene-config.ts          → re-exports from @/lib/scene-visuals (SCENE_CONFIG)
├── function-call-executor.ts→ thin wrapper that delegates to fc-dispatcher
└── route-utils.ts           → route helper functions extracted from process/route.ts
```

The re-export facade files (`engine.ts`, `types.ts`, `npc-ai.ts`, `npc-prompts.ts`, `scenes.ts`, `scene-config.ts`) are marked `@deprecated` with `@see` pointers to the canonical source. New code should import directly from the source modules (`@/lib/engine`, `@/lib/npc`, `@/lib/scenes`). The facade exists for backward compatibility with early callers.

`function-call-executor.ts` is a thin wrapper that delegates to `dispatchFC` in `src/lib/engine/fc-dispatcher.ts` (ontology-driven dispatch). `route-utils.ts` is a canonical implementation extracted from the API route.

### Actual Implementation Locations

| Capability | Source module | Key files |
|:-----------|:-------------|:----------|
| Game loop (4 stages + AI wrappers) | `lib/engine/` | `game-loop.ts` |
| Session management | `lib/engine/` | `session.ts` |
| AI action classifier | `lib/engine/` | `ai-classifier.ts` |
| Keyword fallback matching | `lib/engine/` | `match.ts` |
| Session context projection | `lib/engine/` | `session-context.ts` |
| Conversation guard | `lib/engine/` | `conversation-guard.ts` |
| Ontology serialization | `lib/engine/` | `ontology.ts` |
| Template substitution | `lib/engine/` | `template.ts` |
| Scene spec loading | `lib/engine/` | `scene-loader.ts` |
| FC ontology-driven dispatch | `lib/engine/` | `fc-dispatcher.ts` |
| Precondition expression eval | `lib/engine/` | `precondition-eval.ts` |
| NPC reply generation | `lib/npc/` | `engine.ts` |
| NPC prompt construction | `lib/npc/` | `prompts.ts` |
| NPC spec loading | `lib/npc/` | `npc-loader.ts` |
| NPC scope (disabled v7) | `lib/npc/` | `scope.ts` |
| Scene definitions | `specs/scenes/` | `*.yaml` (loaded by `scene-loader.ts`) |
| NPC definitions | `specs/npcs/` | `*.yaml` (loaded by `npc-loader.ts`) |
| Scene registry | `lib/scenes/` | `registry.ts`, `index.ts` |
| FC execution (thin wrapper) | `lib/gm/` | `function-call-executor.ts` |
| Route utilities | `lib/gm/` | `route-utils.ts` |
| Route orchestration | `app/api/gm/process/` | `route.ts` |

---

## §3 API Route Orchestration

`POST /api/gm/process` is the single entry point for all GM interactions. It dispatches on the `action` field and handles four flows.

### §3.1 Request Schema

```ts
{
  message?: string          // PA's formulated message (Stage 1 output)
  sessionId?: string        // Existing session to resume
  action?: 'enter' | 'message' | 'subflow_confirm' | 'subflow_cancel'
  originalMessage?: string  // Human's raw input (advisor mode)
  mode?: 'manual' | 'auto' | 'advisor'
  sceneId?: string          // Target scene (enter action only)
  args?: Record<string, unknown>  // SubFlow confirm args
}
```

### §3.2 Dispatch Branches

```text
POST /api/gm/process
 │
 ├── action === 'subflow_confirm'
 │    → routeSubFlowConfirm(session, args, user, request)
 │    → Return handler-specific response
 │
 ├── action === 'subflow_cancel'
 │    → cancelSubFlow(session)
 │    → Return cancellation acknowledgment
 │
 ├── action === 'enter' || !sessionId
 │    → Enter Scene Flow (§3.3)
 │
 └── else (action === 'message' or default)
      ├── SubFlow active? → routeSubFlow(session, input, user)
      │    └── auto mode + confirm step → auto-confirm
      └── Normal Game Loop Flow (§3.4)
```

### §3.3 Enter Scene Flow

```text
1. getOrCreateSession(sessionId, mode)
2. Clear active SubFlow if any
3. Navigator exhaustion check (lobby re-entry ≥ 3 → session ends)
4. Load scene data via dataLoader if configured
5. enterSceneWithAI(session, sceneId, sceneData, visitorInfo)
   a. enterScene — state update, visitedScenes tracking, return context for lobby
   b. buildSessionContextForNPC — project session state for NPC
   c. generateNPCReply — AI-generated scene opening
6. Record event + achievement
7. Log turn
8. Wrap message in MessageEnvelope → return response
```

### §3.4 Normal Game Loop Flow

The message processing pipeline has two phases separated by FC execution:

```text
Phase A: Classify + Resolve + Apply
  1. processMessageWithAI(session, message, visitorInfo, originalMessage, accessToken)
     a. classifyAction (§5) — cache → AI → keyword fallback
     b. resolveTurn — 5-branch RESOLVE (see game-loop-architecture §4)
     c. applyResult — state update
     → Returns ProcessMessageResult with _turnMeta, functionCall status: 'pending'

Phase B: Execute + React
  2. Execute FC (§7) — leavePlatform, SubFlow activation, or business logic
  3. Action repeat guard — same FC ≥ 3 times in scene → circuit breaker
  4. Compute return context (§6.1) — if transitioning to lobby
  5. generateNPCReplyForTurn (§4.3) — NPC reply with FC result knowledge
  6. Refine return context if NPC assessed scope redirect
  7. Record journey event + persist session
  8. Cross-scene transition loop check (§5.3)
  9. Wrap in MessageEnvelope → return response
```

### §3.5 Session End Handling

When `sessionEnded === true` (from `pa_leave`, `loop_guard`, or `navigator_exhausted`):

- Session log is closed with end reason
- Response includes `sessionEnded: true` and `summary` (visited scenes, achievements, total turns)
- No NPC reply is generated after session ends

---

## §4 NPC AI Pipeline

### §4.1 NPC Resolution

Each scene maps to exactly one NPC via a static lookup:

| Scene | NPC key | NPC name |
|:------|:--------|:---------|
| `lobby` | `gm` | 灵枢兔 |
| `news` | `editor` | 编辑部助手 |
| `developer` | `tech-advisor` | 技术顾问 |

Resolution: `resolveNPCKey(sceneId)` — falls back to `'gm'` for unknown scenes.

NPC records are stored in the database (`prisma.nPC`) with `key`, `ownerId`, `isActive`, and `systemPrompt`. The `ownerId` links to a SecondMe user whose PA intelligence powers the NPC.

### §4.2 Token Management

NPC replies require a valid SecondMe access token for the NPC's owner:

```text
1. Look up NPC record by key
2. If !npc || !ownerId || !isActive → return template fallback
3. Check owner's tokenExpiresAt
   a. Expired → refreshAccessToken(refreshToken) → update DB
   b. Refresh fails → return template fallback
4. Use token for callSecondMeStream
```

### §4.3 generateNPCReply Pipeline

```text
generateNPCReply(context: NPCReplyContext) → NPCReplyResult

Input:
  - sceneId, visitorMessage, outcome, sceneData
  - visitorInfo (name, type), entryType (first|return)
  - isFreeChat, sessionContext, fcResult
  - recentNpcMessages (for anti-repetition)

Pipeline:
  1. Resolve NPC key and scene definition
  2. Compute template fallback (outcome message, opening, or scene fallback)
  3. Fetch NPC record + owner token (§4.2)
  4. Build NPC message via buildNPCMessage (§4.4)
  5. Build system prompt:
     a. NPC's base systemPrompt (personality, role, scope)
     b. Platform ontology (serializeForNPC — world map, exits, capabilities)
     c. Communication protocol (serializeProtocolForNPC — decision protocol)
  6. Call SecondMe chat/stream API with MODEL_FOR.npcDialogue (Sonnet)
  7. Strip LLM internal tags (stripLLMTags — <think>, <thinking>, etc.)
  8. Build agent text (structured English for API consumers)
  9. Return { pa, agent, meta: { scopeAssessment } }

Fallback chain:
  - NPC not found/inactive → template fallback
  - Token refresh fails → template fallback
  - AI call throws → template fallback
  - AI returns empty after tag stripping → template fallback (pa field)
```

### §4.4 NPC Message Construction

`buildNPCMessage` assembles the user-facing message sent to the NPC's LLM:

| Section | Condition | Content |
|:--------|:----------|:--------|
| Actions | actions present | Available action labels |
| Session context | sessionContext present | Projected session state (§6) |
| Scene data | sceneData present | Key-value pairs from dataLoader |
| Outcome | outcomeDescription present | "访客的操作结果：..." |
| Free chat hint | isFreeChat | 4-rule conversational guidance: no "off-topic" phrasing, natural chat, soft recommendations, escalate only after sustained idle |
| Visitor name | visitorName present | "访客名称：..." |
| Visitor message | visitorMessage present | "访客说：「...」" |
| Anti-repetition | recentNpcMessages present | Last 3 NPC messages to avoid repeating |
| Response style | always | Entry-type-dependent instruction (first/return/default) |

### §4.5 generateNPCReplyForTurn

Called **after** FC execution so the NPC knows what actually happened:

- **MOVE outcomes**: skipped — template farewell from `resolveTurn` is used; the arriving scene generates its own opening via `enterSceneWithAI`
- **STAY outcomes**: builds session context with `fcResult`, calls `generateNPCReply`, runs conversation guard (`checkAndRecord`)

---

## §5 AI Classifier Pipeline

The AI classifier replaces keyword matching as the primary action resolution mechanism. Detailed in `ai-classifier.ts`.

### §5.1 Resolution Order

```text
1. Cache (5 min TTL, max 200 entries)
   Key: sceneId + message (trimmed, lowercased, first 200 chars)
   Hit: return cached actionId (skip gated actions)
   Miss: continue

2. AI Classification (8s timeout)
   Model: MODEL_FOR.actionClassify (Flash)
   API: SecondMe act/stream endpoint
   Input: scene actions + other scenes + session context + action constraints
   Output: { actionId, confidence }
   
   If confidence < 0.7:
     → Keyword fallback override (if keyword matches and differs from AI)
   
   Gated actions (precondition failed) excluded from valid matches

3. Keyword Fallback
   matchAction: for each action, check triggers[] against message
   First match wins; gated actions excluded

4. Free Chat
   No match → actionId = '_fallback'
   NPC responds freely, guides toward available actions
```

### §5.2 Classifier Prompt Structure

The classifier receives a structured prompt via `buildPayload`:

```text
根据用户在「{场景名}」场景的发言判断意图，选择一个操作。

可用操作：
- [action_id] label（留在场景/离开场景）intent: actIntent
...

平台其他场景：
- 场景名（scene_id）
...

当前会话状态：(from buildSessionContextForClassifier)
- 正在体验的应用：{name|无}
- 已完成体验：{是|否}

操作可用性：
- [action_id] 可用/不可用（原因）

分类规则：
- 意图明确 → 返回操作 id
- 涉及其他场景功能 → back_lobby
- 不可用操作 → 空 actionId
- 闲聊/意图不明 → 空 actionId
```

### §5.3 Cross-Scene Intent Routing

The classifier sees both current scene actions and other scenes' labels. This enables correct routing of cross-scene intents: e.g., saying "注册" in the news scene routes to `back_lobby` (a move action) rather than matching a news-scene action.

---

## §6 Cross-Scene Memory

### §6.1 Return Context

When PA transitions to lobby, the route computes a `ReturnContext` that persists in `session.flags.returnContext`:

```ts
interface ReturnContext {
  fromScene: string       // Which scene the PA came from
  npcName: string         // NPC who was hosting
  reason: 'task_complete' | 'no_data' | 'pa_initiative' | 'scope_redirect'
  recommendation?: string // Suggested next scene
  summary: string         // Human-readable summary
}
```

The lobby's `enterScene` reads this context to populate template variables (`returnFromLabel`, `returnSummary`, `recommendedHint`) in the lobby opening.

**Reason determination logic:**

| Condition | Reason | Recommendation |
|:----------|:-------|:---------------|
| `session.data.hasApps === false` | `no_data` | Opposite scene (news↔developer) |
| FC executed successfully (non-navigation) | `task_complete` | None |
| Otherwise | `pa_initiative` | None |
| NPC scope assessment = redirect (post-NPC) | `scope_redirect` | None |

### §6.2 PA Goals

When a recommendation exists and no current goal is set, the route derives a `PAGoal`:

```ts
interface PAGoal {
  purpose: string      // e.g. "去开发者空间推荐应用给日报"
  derivedFrom: string  // Summary text that triggered the goal
  sceneId: string      // Scene where the goal was derived
}
```

Goals persist in `session.flags.currentGoal` and appear in NPC session context.

### §6.3 Journey Events

`recordEvent(session, description)` appends brief event descriptions to `session.flags.recentEvents` (capped at 10). Events feed into NPC session context as "访客旅程记忆".

### §6.4 Navigator Exhaustion

Lobby re-entry counter (`session.flags.navigatorAttempts`) increments each time PA returns to lobby after visiting other scenes. At 3+ attempts, session ends with `navigator_exhausted`. Counter resets when PA successfully leaves lobby.

---

## §7 Function Call Execution

### §7.1 Dispatch Architecture

FC execution uses an **ontology-driven dispatch** model. `executeFunctionCall` (in `src/lib/gm/function-call-executor.ts`) is a thin wrapper that delegates to `dispatchFC` (in `src/lib/engine/fc-dispatcher.ts`).

`fc-dispatcher` reads the `execution` field from each FC entry in `operational-ontology.json` and routes to one of four handler types:

```text
operational-ontology.json[fcName].execution
  │
  ├── type: "builtin"  → handleBuiltin(handler)
  │     handler: "navigation"  → { status: 'executed' }
  │     handler: "passthrough" → { status: 'executed', detail: 'dataLoader 已加载' }
  │
  ├── type: "subflow"  → activateSubFlowFromSpec(session, specName, context)
  │     specName: "register" | "app-settings" | "app-lifecycle" | "profile"
  │
  ├── type: "handler"  → invokeEffect(handlerKey, args, effectCtx)
  │     handlerKey: "fc.assignMission" | "fc.saveReport"
  │     (registered in handler-registry.ts)
  │
  └── type: "behavior" → activateBehavior(session, specId)
```

If no `execution` field is found for an FC, the dispatcher returns `{ status: 'skipped' }`.

After dispatch, the dispatcher also checks if the FC matches a BehaviorSpec's `trigger.onFunctionCall` and auto-activates it if so.

#### FC Classification (13 FCs)

| Category | FC names | execution.type |
|:---------|:---------|:---------------|
| navigation (5) | enterSpace, rest, help, fallback, leavePlatform | `builtin` (handler: navigation) |
| display (2) | showApps, showFeedback | `builtin` (handler: passthrough) |
| subflow (4) | startRegistration, startAppSettings, startAppLifecycle, startProfile | `subflow` |
| business (2) | assignMission, saveReport | `handler` |

`GM.leavePlatform` is intercepted at the route layer before dispatch (session end semantics).

### §7.2 FC Result Shape

```ts
interface FCResult {
  name: string
  status: 'executed' | 'skipped' | 'failed'
  detail?: string
}
```

The `status` field determines NPC behavior:

- `executed` → NPC describes what happened (via `describeFCForNPC` from operational ontology)
- `skipped` → NPC explains why it didn't happen
- `failed` → NPC acknowledges the error

### §7.3 SubFlow Interception

When a SubFlow is active (`session.flags.subFlow` set), all messages are intercepted by `routeSubFlow` before reaching the normal game loop. In auto mode, when the SubFlow reaches the `confirm` step, auto-confirmation bypasses the UI confirmation button.

---

## §8 Conversation Guard System

Four detection modes protect against conversational dead loops. See engine-invariants.md for structural rules; this section covers implementation details.

### §8.1 NPC Message Repetition

**State**: `session.flags._conversationHistory`

```ts
{
  npcMessages: string[]      // Last 10 NPC messages
  paMessages: string[]       // Last 10 PA messages (for anti-repetition in PA prompt)
  consecutiveRepeats: number // Current streak of similar messages
  lastMessage: string        // Previous NPC message
  guardTriggered: boolean    // Whether guard has fired this session
}
```

**PA history utilities**: `recordPaMessage(session, msg)` appends to `paMessages` (trimmed to `HISTORY_SIZE`). `getPaHistory(session, count)` returns the last N PA messages — consumed by `pa-respond/route.ts` to inject `{paHistory}` into the PA prompt and prevent PA from echoing itself.

**Similarity check**: Normalize (strip whitespace + punctuation, truncate to 120 chars), then check exact match or substring containment. Threshold: 3 consecutive similar messages.

**Reset**: On scene transition (`resetGuard`). Resets both `npcMessages` and `paMessages`. Does NOT reset transition history.

### §8.2 Same-Scene Action Repeat

**State**: `session.flags._actionRepeat`

```ts
{
  sceneId: string   // Current tracking scene
  actionId: string  // Current tracking action
  count: number     // Consecutive repeat count
}
```

Catches loops where NPC text varies (evading mode 1) but the underlying FC is identical. Threshold: 3 repeats of the same FC in the same scene.

### §8.3 A↔B Ping-Pong

**State**: `session.flags.transitionHistory` (array of `{ from, to, turn }`, max 20)

Detects the same two scenes alternating 2+ times. Checked after each scene transition.

### §8.4 Path Cycle Detection

Uses the same transition history. Detects repeating scene sequences of length ≥ 3 (e.g., lobby → news → dev → lobby → news → dev). Scans a 12-transition window.

### §8.5 Guard Escalation in Auto Mode

In auto mode, any guard trigger (action repeat, transition loop) escalates to session end with `loop_guard` reason. In manual mode, the override message is shown but the session continues.

---

## §9 Session Context Projection

Two projection functions serialize session state into structured text for AI consumers.

### §9.1 For Classifier (`buildSessionContextForClassifier`)

Provides action availability and session state so the classifier can avoid matching gated actions:

```text
当前会话状态：
- 正在体验的应用：{name|无}
- 已完成体验：{是|否}

操作可用性：
- [action_id] 可用
- [action_id] 不可用（原因）

重要：不可用的操作不应被匹配。
```

### §9.2 For NPC (`buildSessionContextForNPC`)

Provides richer context including FC results, journey memory, and PA goals:

```text
会话状态：
- 访客正在体验「appName」/ 已体验过 / 尚未体验
- 可用操作：label1、label2
- 不可用：label3（原因）

如果访客想做不可用的操作，引导他先做前置步骤。

操作执行结果：(from describeFCForNPC)
- 「label」执行成功 / 未执行

访客旅程记忆：
- 已访问过的场景：label1、label2
- 刚从「label」回来
- 返回原因：summary
- NPC建议去：label
- 当前目标：purpose
- 最近经历：event1；event2
```

### §9.3 Precondition State

`checkPrecondition` in `session-context.ts` evaluates precondition expressions using `precondition-eval.ts`. The evaluator supports a small DSL:

```text
Syntax: <path> <op> <value>
path:   session.flags.<key> | session.data.<key>
op:     == | != | exists | !exists
combo:  expr && expr | expr || expr | !expr
```

Example expressions and their legacy equivalents:

| Expression | Legacy string |
|:-----------|:-------------|
| `session.flags.hasExperienced == true` | `hasExperienced` |
| `session.data.hasApps == true` | `hasApps` |
| `session.data.isDeveloper != true` | `notDeveloper` |
| `session.data.isDeveloper == true` | `isDeveloper` |

The evaluator tries expression parsing first; if parsing fails, it falls back to the legacy string-to-boolean mapping for backward compatibility.

---

## §10 Event Logging Integration

The route integrates with the event logging system (see event-logging.md):

1. `ensureSessionLog` — creates or retrieves session-level log record
2. `logTurn` — records per-turn metrics (async, non-blocking via `.catch(() => {})`)
3. `closeSessionLog` — finalizes session log with end reason

Every dispatch branch (enter, message, subflow_confirm, subflow_cancel) logs a turn with relevant fields.

---

## §11 Response Envelope

All responses wrap `DualText` messages in `MessageEnvelope` at the API boundary:

```ts
interface MessageEnvelope extends DualText {
  sender: SenderRole    // 'npc' | 'system' | 'pa'
  channel: MessageChannel  // 'public' | 'private' | 'system'
  meta?: MessageMeta
}
```

Sender determination:

- Normal NPC reply → `'npc'`
- Guard override (loop/repeat) → `'system'`
- Scope redirect → `'system'`

Meta includes: `fcName`, `fcStatus`, `scopeAssessment`.
