# Event Logging — Session & Turn Analytics

Event logging captures game sessions and turns for PA behavior analysis. Logs are persisted to `game_session_logs` and `game_turn_logs` tables. The pipeline feeds `.cursor/rules/pa-behavior-audit.mdc` for log-driven optimization.

---

## §1 Overview

- **Purpose**: Enable before/after comparison of PA behavior fixes, pattern detection, and root cause tracing.
- **Entry point**: `POST /api/gm/process` — all logging is triggered from this route.
- **Pattern**: Fire-and-forget; callers do not await in the hot path. Logging failures are logged to console but do not affect the response.

---

## §2 ENGINE_VERSION Strategy

```ts
// src/lib/engine/event-logger.ts
export const ENGINE_VERSION = '10'
```

- **When to bump**: On deploying PA behavior fixes (prompts, guards, navigator logic, etc.).
- **Effect**: Every new session log is tagged with the current version. Old sessions retain their version.
- **Use**: Filter logs by `engine_version` for before/after comparison. See `pa-behavior-audit.mdc` Phase 0.

---

## §3 Data Model

### 3.1 SessionLogParams

Input to `ensureSessionLog`. Maps to `GameSessionLog` creation/update.

| Field       | Type    | Required | Description                                      |
| :---------- | :------ | :------- | :----------------------------------------------- |
| `sessionId` | string  | ✓        | Ephemeral session ID (in-memory Map key)         |
| `userId`    | string  | ✓        | Authenticated user ID                            |
| `agentId`   | string? |          | SecondMe agent ID when PA mode                   |
| `agentName` | string? |          | Display name for PA                              |
| `mode`      | string  | ✓        | `manual` \| `advisor` \| `auto`                   |
| `startScene`| string  | ✓        | Initial scene (usually `lobby`)                  |

### 3.2 TurnLogParams

Input to `logTurn`. Maps to `GameTurnLog` creation.

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `sessionId` | string | ✓ | Session ID |
| `userId` | string | ✓ | User ID |
| `turnNumber` | number | ✓ | `session.globalTurn` |
| `sceneId` | string | ✓ | Scene at turn start |
| `mode` | string | ✓ | Session mode |
| `action` | string | ✓ | `enter` \| `message` \| `subflow_confirm` |
| `inputContent` | string? | | PA message or subflow payload |
| `originalMessage` | string? | | Raw human input (advisor mode) |
| `actionMatched` | string? | | Matched function call name (e.g. `GM.leavePlatform`) |
| `matchMethod` | string? | | `ai_classifier` \| `free_chat` |
| `classifierConfidence` | number? | | **v10+** — AI classifier confidence (0.0–1.0) |
| `classifierSource` | string? | | **v10+** — Classification path: `ai` \| `keyword` \| `cache` |
| `outcomeType` | string? | | `stay` \| `move` |
| `functionCallName` | string? | | FC name |
| `functionCallStatus` | string? | | `executed` \| `skipped` \| `failed` |
| `npcReply` | string? | | NPC response text (pa side) |
| `transitionFrom` | string? | | Scene left |
| `transitionTo` | string? | | Scene entered |
| `paIntent` | string? | | **v10+** — PA's extracted intent (from `pa-respond` Stage 2) |
| `paConfidence` | number? | | **v10+** — PA's confidence in its own intent (0.0–1.0) |
| `paGoal` | string? | | **v4+** — `currentGoal.purpose`; intent driving navigation |
| `returnReason` | string? | | **v4+** — why PA returned to lobby |
| `loopDetected` | boolean? | | Guard fired (repetition / ping-pong / path cycle) |
| `guardType` | string? | | **v10+** — Which guard: `npc_repetition` \| `action_repeat` \| `transition_loop` |
| `isSubFlow` | boolean? | | Turn was handled by subflow (register, profile, etc.) |
| `errorOccurred` | boolean? | | API or logic error |
| `errorDetail` | string? | | Error message |
| `durationMs` | number? | | Turn processing time |
| `npcGenerateMs` | number? | | **v10+** — NPC reply generation latency (ms) |

**v4+ fields**: `paGoal` and `returnReason` were added in engine v4 for intent-level analysis.

**v10+ fields**: Six analytics fields added for the testing/optimization cycle:

| Field | Source | Analysis value |
|:------|:-------|:---------------|
| `classifierConfidence` | `ClassifyResult.confidence` via `_turnMeta` | Low confidence → keyword fallback accuracy |
| `classifierSource` | `ClassifyResult.source` via `_turnMeta` | AI vs keyword vs cache distribution |
| `paIntent` | PA respond Stage 2 → `session.flags._lastPaIntent` | PA intent vs classifier action alignment |
| `paConfidence` | PA respond Stage 2 → `session.flags._lastPaConfidence` | Low PA + low classifier confidence = prompt issue |
| `guardType` | Derived from guard booleans in route | Root cause triage: which guard pattern fires most |
| `npcGenerateMs` | `Date.now()` diff around `generateNPCReplyForTurn` | Performance bottleneck identification |

---

## §4 Integration Points

All logging is triggered from `src/app/api/gm/process/route.ts`.

### 4.1 ensureSessionLog

| Location | When |
| :------- | :--- |
| Line 39  | Once at request start, after `getOrCreateSession`. Creates or updates session log; returns `sessionLogId` for all subsequent `logTurn` / `closeSessionLog` calls. |

### 4.2 logTurn — 5 call sites

| # | Route branch | Line | Action | Notable fields |
| :-| :----------- | :--- | :----- | :-------------- |
| 1 | `action === 'subflow_confirm'` | 50–61 | `subflow_confirm` | `isSubFlow: true`, `inputContent: JSON.stringify(body.args)` |
| 2 | `action === 'enter'` + navigator exhaustion (lobby re-entry ≥3) | 87–99 | `enter` | `paGoal`, `returnReason: 'navigator_exhausted'`, `outcomeType: 'stay'` |
| 3 | `action === 'enter'` + success | 135–149 | `enter` | `npcReply`, `paGoal`, `outcomeType`, `transitionFrom`/`transitionTo` |
| 4 | `routeSubFlow(session, message)` returns (subflow active) | 161–174 | `message` | `isSubFlow: true`, `inputContent: message` |
| 5 | Normal game loop (after `processMessageWithAI` + NPC reply) | 293–315 | `message` | Full turn: all v4 fields + v10 analytics (`classifierConfidence`, `classifierSource`, `paIntent`, `paConfidence`, `guardType`, `npcGenerateMs`) |

### 4.3 closeSessionLog — 3 call sites

| # | Route branch | Line | endReason |
| :-| :----------- | :--- | :-------- |
| 1 | Navigator exhaustion (lobby re-entry ≥3) | 80  | `navigator_exhausted` |
| 2 | PA triggers `GM.leavePlatform` | 191 | `pa_leave` |
| 3 | Transition loop detected in auto mode | 242 | `loop_guard` |

> Note: `timeout` (session TTL) is set by the session manager, not by this route. It does not call `closeSessionLog`; the session simply expires.

---

## §5 Fire-and-Forget Pattern

All logging functions are invoked without `await` in the hot path:

```ts
logTurn(sessionLogId, { ... }).catch(() => {})
closeSessionLog(sessionLogId, endReason).catch(() => {})
```

- **Rationale**: Logging must not block or delay the HTTP response.
- **Error handling**: Failures are logged via `console.error` inside the logger. Callers swallow rejections with `.catch(() => {})` so unhandled promise rejections do not surface.

---

## §6 Data Pipeline → pa-behavior-audit.mdc

| Stage | Flow |
| :---- | :--- |
| **Write** | `event-logger.ts` → `game_session_logs` / `game_turn_logs` |
| **Read** | `pa-behavior-audit.mdc` Phase 1–5: SQL queries, pattern detection, root cause tracing |
| **Versioning** | `engineVersion` on session logs enables Phase 0 filtering and before/after comparison |
| **Verification** | `node scripts/check-logs.js [version]` pulls versioned data for post-fix verification |

The rule file defines the analysis pipeline; this document defines the data model and integration points that feed it.
