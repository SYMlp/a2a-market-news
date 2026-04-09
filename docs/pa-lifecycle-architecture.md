# PA Lifecycle Architecture

This document describes the PA (Player Agent) lifecycle subsystems: session context projection, preconditions, PA goals, return context, achievements, platform ontology, and the SubFlow system. These components form the bridge between the engine's state machine and the AI layers (classifier, NPC).

**Derivation sources**: `src/lib/engine/session-context.ts`, `src/lib/engine/ontology.ts`, `src/lib/engine/platform-ontology.json`, `src/lib/subflow/router.ts`, `src/lib/component-runtime/subflow-adapter.ts`, `src/lib/component-runtime/subflow-persistence.ts`, `src/lib/component-runtime/handler-registry.ts`, `src/app/api/gm/process/route.ts`, `src/lib/pa/prompts.ts`, `src/lib/pa/intent.ts`, `src/lib/pa/auto-loop.ts`, `src/lib/pa-engine.ts`, `src/app/api/gm/pa-respond/route.ts`, `src/lib/prompt-loader.ts`

---

## §1 Overview

The PA lifecycle layer projects session state into structured text for AI prompts. It enforces action preconditions, tracks PA goals for purpose-driven navigation, records cross-scene return context, provides the platform ontology (world map) to both NPC and PA prompts, and manages multi-turn SubFlows (registration, app settings, profile, app lifecycle).

---

## §2 Session Context Projection

Two projection functions convert session state into prompt-ready text for different consumers.

### 2.1 `buildSessionContextForClassifier`

**Purpose**: Feed the AI classifier with current state and action availability so it can avoid matching unavailable actions.

**Output structure**:
- **当前会话状态**: experiencing app, hasExperienced flag
- **操作可用性**: per-action availability with reason when gated
- **Constraint rule**: "不可用的操作不应被匹配。如果用户意图指向不可用操作，返回空 actionId。"

**Source**: `session-context.ts` lines 62–84

### 2.2 `buildSessionContextForNPC`

**Purpose**: Give the NPC host enough context to respond and guide the visitor, including FC execution results.

**Output structure**:
- **会话状态**: experiencing app / hasExperienced / available actions / gated actions with reasons
- **Guidance**: "如果访客想做不可用的操作，用你的方式引导他先做前置步骤。"
- **操作执行结果** (when `fcResult` provided): success/failure and detail

**Source**: `session-context.ts` lines 86–136

---

## §3 Precondition System

Scene actions may declare a `precondition` that gates availability. The engine evaluates preconditions via `checkPrecondition(check, session)` and `buildActionConstraints(actions, session)`.

### 3.1 Supported Checks

| Check          | Condition                                      | Typical use                          |
|----------------|------------------------------------------------|--------------------------------------|
| `hasExperienced` | `session.flags?.hasExperienced === true`       | Submit report only after experiencing |
| `hasApps`        | `session.data?.hasApps === true`              | Show apps / assign mission           |
| `notDeveloper`   | `session.data?.isDeveloper === false`         | Visitor-only actions                 |
| `isDeveloper`    | `session.data?.isDeveloper === true`         | Developer-only actions               |

Unknown checks default to `true` (no gate).

### 3.2 ActionConstraint

Each action maps to an `ActionConstraint`:

```ts
interface ActionConstraint {
  actionId: string
  available: boolean
  reason?: string  // from precondition.failMessage.pa when unavailable
}
```

**Source**: `session-context.ts` lines 38–60

---

## §4 PA Goal System

PA goals drive purpose-based navigation. The lobby navigator (灵枢兔) uses goals to recommend scenes that match the visitor's intent.

### 4.1 PAGoal Interface

```ts
interface PAGoal {
  purpose: string   // e.g. "想体验应用"
  derivedFrom: string
  sceneId: string  // where the goal was derived
}
```

### 4.2 Storage and Access

- **Storage**: `session.flags.currentGoal`
- **Access**: `getCurrentGoal(session)` / `setCurrentGoal(session, goal | null)`

### 4.3 Usage

- PA ontology context (`serializeForPA`) includes current goal: `→ 你的目标：${goal.purpose}`
- Goal is derived from PA's `[GOAL: ...]` output tag (v7: regex inference removed, only explicit tags)
- NPC ontology context includes `capability_map` so NPC can recommend scenes matching the goal

**Source**: `session-context.ts` lines 139–154; `ontology.ts serializeForPA`; `pa-respond/route.ts` goal parsing

---

## §5 Return Context

When the PA transitions back to the lobby from another scene, the engine records **ReturnContext** so the lobby navigator can give smart recommendations and avoid repeating failed suggestions.

### 5.1 ReturnContext Interface

```ts
interface ReturnContext {
  fromScene: string
  npcName: string
  reason: 'no_data' | 'scope_redirect' | 'pa_initiative' | 'task_complete'
  recommendation?: string  // suggested next scene (e.g. 'developer')
  summary: string
}
```

### 5.2 Four Return Reasons

| Reason           | Trigger                                                                 | recommendation |
|------------------|-------------------------------------------------------------------------|-----------------|
| `scope_redirect` | NPC scope gate redirected (out-of-scope message)                        | —               |
| `no_data`        | `session.data?.hasApps === false` (no apps yet)                         | `'developer'`   |
| `task_complete`  | FC executed (non-navigation) and PA returned to lobby                  | —               |
| `pa_initiative`  | Visitor chose to go back without completing a task                     | —               |

### 5.3 Integration

- **Set**: `process/route.ts` when `attemptedTransition?.to === 'lobby'` (lines 263–293)
- **Read by NPC**: `serializeForNPC` includes return context in lobby NPC's prompt via session context
- **Read by PA**: `serializeForPA` includes return context summary (e.g. "你刚从日报栏回来：目前没有应用入驻")

**Source**: `types.ts` ReturnContext; `session-context.ts` lines 156–164; `ontology.ts serializeForPA`; `process/route.ts` lines 263–293

---

## §6 Achievements

Achievements record notable in-session actions (explore, FC executions). They serve two purposes:

1. **PA prompt injection** (v12): `serializeForPA` filters achievements by current scene and injects a "你在这里做过的事" section into the PA prompt, preventing semantic repetition (PA re-triggering actions it already completed).
2. **Session summary**: included in the end-of-session summary for analytics.

Navigation FCs are excluded.

### 6.1 SceneAchievement

```ts
interface SceneAchievement {
  sceneId: string
  actionId: string
  label: string
  timestamp: number
}
```

### 6.2 Navigation FCs (Excluded)

`GM.enterSpace`, `GM.rest`, `GM.help`, `GM.fallback`, `GM.leavePlatform` — these do not create achievements.

### 6.3 Recording

- **Explore**: `recordAchievement` when entering a non-lobby scene for the first time (`process/route.ts`)
- **FC executed**: `recordAchievement` when a non-navigation FC succeeds (`process/route.ts`)

**Source**: `session-context.ts` `recordAchievement`; `process/route.ts` (enter scene + FC execution branches)

---

## §7 Platform Ontology — Prompt Context (v7)

In v7, the journey summary (`buildJourneySummary`) and navigator context (`buildNavigatorContext`) were replaced by the **platform ontology** system. A single JSON file defines the world model, and two serialization functions project it into prompt-ready text.

### 7.1 Platform Ontology (`platform-ontology.json`)

Single source of truth for the platform's world model:

```json
{
  "scenes": {
    "<sceneId>": {
      "label": "中文名",
      "npc": "NPC名称",
      "role": "场景职责",
      "capabilities": ["能做的事1", "能做的事2"],
      "exits": ["可达的场景ID"]
    }
  },
  "topology_rules": ["拓扑约束"],
  "capability_map": { "用户意图": "对应场景ID" }
}
```

### 7.2 NPC View (`serializeForNPC`)

Injected into NPC system prompt. Tells the NPC:
- Its own capabilities and scene role
- Available exits from current scene
- Other scenes' capabilities and how to reach them (direct vs. via lobby)
- Navigation rules ("场景之间不能直达，必须经过大厅")
- Capability map: visitor desires → target scene (helps NPC redirect)

Replaces: `buildScopeConstraint` (one-liner) + `buildNavigatorContext` (80 lines)

### 7.3 PA View (`serializeForPA`)

Injected into PA prompt (both auto and advisor modes). Provides:
- Full platform map with visit status (✓已去过 / ✗还没去过)
- Capability map: desires → target scene (helps PA plan navigation)
- Journey event flow (from `recentEvents`, last 6)
- Return context summary (if PA just came back from a scene)
- Current goal (if set)
- Unvisited scenes
- **Current action state** (added v7.1): when `experiencingApp` is set, tells PA it is mid-experience and should proceed to report; when a `subFlow` is active, tells PA to continue the current step. This prevents auto-mode loops where PA repeats the same action intent without progressing.
- **Scene staleness nudge** (added v12): when `sceneTurns >= 4`, appends "⚠ 你在当前场景已经待了 N 轮了" warning, nudging PA to consider moving to other scenes.
- **Completed actions** (added v12): filters `achievements` by current scene and appends "你在这里做过的事" section with action list + "不要重复触发" instruction. Prevents semantic-level repetition (e.g. re-triggering `GM.assignMission` after already completing it).

Replaces: `buildJourneySummary` (40 lines) + `goalContext` injection + `journeyContext` injection

### 7.4 Data Sources

- `session.flags.recentEvents` — brief event descriptions (max 10), via `recordEvent()`
- `session.flags.visitedScenes` — scene IDs visited
- `session.flags.returnContext` — ReturnContext from last scene transition
- `session.flags.currentGoal` — PAGoal
- `session.flags.experiencingApp` — currently assigned app (name + clientId), set by `GM.assignMission`
- `session.flags.hasExperienced` — whether PA has been assigned an experience task
- `session.flags.subFlow` — active SubFlow state (type + step)
- `session.flags.achievements` — `SceneAchievement[]`, filtered by current scene for "completed actions" section (v12)
- `session.flags.sceneTurns` — number, incremented per turn, reset on scene transition; triggers staleness nudge at >= 4 (v12)

### 7.5 Design Rationale

The old approach used ~160 lines of TypeScript to reconstruct navigation context and journey state, effectively "thinking for the LLM". The ontology approach provides raw facts (map + events) and lets the LLM reason about navigation decisions. This:
- Eliminated the lobby ↔ news dead loop (v6 bug)
- Reduced code complexity by ~120 lines
- Made scope enforcement self-consistent (NPC never suggests unreachable destinations)

### 7.6 Navigator Exhaustion (unchanged)

When PA returns to lobby 3+ times without successful navigation, the session ends with `navigator_exhausted`. `navigatorAttempts` resets when PA successfully leaves lobby.

**Source**: `ontology.ts`; `platform-ontology.json`; `session-context.ts` (recordEvent, PAGoal, ReturnContext unchanged); `process/route.ts` lines 70–110

---

## §8 Operational Ontology (`operational-ontology.json`)

While the **platform ontology** (§7) describes "what the world looks like" (scenes, topology, capabilities), the **operational ontology** describes "how the engine works" — function call semantics, data loader endpoints, and precondition meanings. Together they form a two-layer ontology system.

### 8.1 Schema

```json
{
  "functionCalls": {
    "GM.assignMission": {
      "label": "分配体验任务",
      "scene": "news",
      "category": "business",
      "requires": "session.data.apps 非空",
      "produces": "设置 experiencingApp 和 hasExperienced",
      "failHint": "平台目前没有应用入驻",
      "npcHint": "访客将去体验应用，完成后回来可以提交报告"
    }
  },
  "dataLoaders": {
    "/api/gm/recommend": {
      "scene": "news",
      "provides": ["hasApps", "apps", "apps_greeting", "apps_hint", "apps_json"],
      "meaning": "获取平台当前入驻的应用列表和推荐语"
    }
  },
  "preconditions": {
    "hasExperienced": { "meaning": "访客已体验过应用", "unlocks": "提交体验报告" }
  }
}
```

**FC categories**: `business` (domain logic), `subflow` (multi-turn flow activation), `display` (data loading), `navigation` (scene transitions / system commands).

### 8.2 Consumption — Not Raw Injection

The operational ontology is **never injected raw into prompts**. TypeScript functions in `ontology.ts` read the registry and produce human-readable text:

- **`describeFCForNPC(fcResult)`** — combines the registry entry (label, produces, failHint, npcHint, sideEffects) with the actual `FCResult` from execution. Replaces bare `"操作执行结果：xxx"` strings with rich context so the NPC understands what happened and what to tell the visitor next.
- **`getSceneLabel(sceneId)`** — replaces all hardcoded `SCENE_LABELS` / `SCENE_NAMES` maps. Single source of truth for scene display names, derived from the platform ontology.

### 8.3 Relationship to `executeFunctionCall`

The operational ontology is a **read-only metadata registry**. It does not replace the `executeFunctionCall` switch statement in `game-loop.ts`. The switch statement contains the actual execution logic (DB writes, session mutations); the ontology describes that logic's semantics for prompt context.

### 8.4 Design Rationale

Before the operational ontology, NPC received bare results like `"GM.assignMission 执行成功"`. The NPC had to guess what that meant. Now it receives:

```
「分配体验任务」执行成功
- 效果：设置 experiencingApp 和 hasExperienced
- 详情：已选择应用「效率助手」
- 附带：写入 AppFeedback、通知开发者
- 提示：访客将去体验应用，完成后回来可以提交报告
```

This enables NPC to give contextually accurate follow-up guidance without encoding domain knowledge in its system prompt.

**Source**: `ontology.ts` (types + `describeFCForNPC` + `getSceneLabel`); `operational-ontology.json`; `session-context.ts` `buildSessionContextForNPC` (calls `describeFCForNPC`)

---

## §9 SubFlow System

SubFlows are multi-turn conversational flows (e.g. app registration, profile edit) that intercept messages while active.

**Implementation**: All four SubFlows are now **spec-driven** via ComponentSpec. Handlers are generated from YAML specs in `specs/` by `component-runtime`; the confirmation UI is rendered by a single `SpecFormCard`. See [component-spec-architecture.md](component-spec-architecture.md) for format, runtime, and handler registry.

### 9.1 State Machine

```
collect → confirm → done
```

- **collect**: Gathering input via `handleMessage`
- **confirm**: Extracted data ready; awaiting `handleConfirm` (often via function call)
- **done**: SubFlow cleared from `session.flags.subFlow`

### 9.2 SubFlowState

```ts
interface SubFlowState {
  type: SubFlowType
  step: string  // 'collect' | 'confirm' | 'done'
  messages: string[]
  context: Record<string, unknown>
  extracted?: Record<string, unknown>
}
```

### 9.3 SubFlowType and Handlers

All handlers are **spec-driven** (generated by `createSubFlowHandler(loadSpec(...))` from ComponentSpec YAML):

| Type           | Spec file         | Purpose                          |
|----------------|-------------------|----------------------------------|
| `register`     | `register.yaml`   | App registration (name, description, circleType) |
| `app_settings` | `app-settings.yaml`| Edit app name/description        |
| `app_lifecycle`| `app-lifecycle.yaml`| Change app status (inactive/archived) |
| `profile`      | `profile.yaml`    | Edit developer profile           |

### 9.4 Handler Interface

```ts
interface SubFlowHandler {
  type: SubFlowType
  handleMessage(session, message, user): NextResponse
  handleConfirm(session, args, user, request): Promise<NextResponse>
}
```

### 9.5 Routing

- **Message path**: `process/route.ts` calls `routeSubFlow(session, subFlowInput, user)` before the normal game loop, where `subFlowInput = originalMessage || message`. In advisor mode, `originalMessage` carries the human's raw input (e.g. a UUID), while `message` contains the PA's formulated response. SubFlow handlers receive the human's raw text to extract structured data reliably.
- **Confirm path**: `action === 'subflow_confirm'` → `routeSubFlowConfirm(session, args, user, request)` → handler's `handleConfirm`.
- **Auto-confirm**: Only in `mode === 'auto'` (checked from the request body, not `session.mode`). When `subFlow.step === 'confirm'` and extracted data exists, confirmation is executed immediately without UI card.

### 9.6 Activation

Function calls `GM.startRegistration`, `GM.startAppSettings`, `GM.startAppLifecycle`, `GM.startProfile` call `activateSubFlow(session, type, initialContext)`, which sets `session.flags.subFlow` with `step: 'collect'`.

`GM.startRegistration` pre-checks the user's existing apps before activating the SubFlow. If the user already has registered apps with clientIds, the FC returns a detail message informing the NPC — no SubFlow is activated. Otherwise, the SubFlow receives `initialContext` containing `existingApps` (array of `{ name, clientId }`) for clientId auto-resolution.

### 9.7 Scene-Scoped Cleanup

`clearSceneScopedFlags` clears `subFlow` (along with `experiencingApp`, `hasExperienced`) when leaving a scene. SubFlow state is scene-scoped.

### 9.8 Validation Gate (Registration)

The `register` SubFlow includes a programmatic validation gate between `collect` and `confirm`. This prevents registering applications with invalid SecondMe clientIds.

**Flow**:

```
extractAppInfo() extracts name, description, circleType, circleName, clientId
  ├─ clientId missing from text AND context has existingApps with clientId
  │    → use context-provided clientId (auto-resolution)
  ├─ clientId missing from text AND no context fallback
  │    → set awaitingClientId state, ask user for SecondMe clientId
  └─ clientId present → applyValidationGate()
       ├─ validateSecondMeApp(clientId, accessToken)
       │   ├─ UUID format invalid → reject
       │   ├─ valid format → pass (fail-open on network errors)
       │   └─ network error → fail-open: allow registration to proceed
       └─ pass → set extracted + step='confirm' → emit GM.registerApp FC
```

**ClientId auto-resolution**: When `GM.startRegistration` activates the SubFlow, it passes the user's existing apps (from DB) as `initialContext.existingApps`. If `extractAppInfo` collects the app name but the message text lacks a clientId, the SubFlow uses the first available clientId from context. This prevents the SubFlow from blocking on information that the AI PA cannot provide (PA has no access to SecondMe developer dashboard).

**Advisor mode input path**: In advisor mode, the human's raw input (which may contain a UUID) is passed via `originalMessage` to the SubFlow, bypassing the PA's formulated response. This ensures clientId extraction works reliably regardless of how the PA rephrases the human's input.

**Fail-open rationale**: Network errors or ambiguous responses allow registration to proceed. False negatives (blocking a real app) are worse than false positives (allowing a questionable app) — the latter can be cleaned up manually.

**Source**: `component-runtime/handler-registry.ts` (effects `validate.secondme-app`, `extract.app-info`, `extract.client-id`); `registration/validate.ts` (`validateSecondMeApp`); `registration/extract.ts` (`extractAppInfo`, `extractClientId`)

**Ontology**: `operational-ontology.json` → `GM.startRegistration` has a `validation` field documenting this gate.

### 9.9 SubFlow Handler Protocol

This section defines the contract between SubFlowHandler implementations and the router/frontend. All handlers are spec-driven (generated by `subflow-adapter.ts` from ComponentSpec YAML) and must follow these rules.

#### 9.9.1 Response Structure

All `handleMessage` and `handleConfirm` responses use `NextResponse.json` with a standard shape:

**Success response** (handleMessage / handleConfirm on success):

```json
{
  "success": true,
  "message": { "pa": "用户可见文本", "agent": "Structured text for API consumers" },
  "currentScene": "session.currentScene",
  "sessionId": "session.id",
  "functionCall": { ... }
}
```

**Error response** (handleConfirm on failure):

```json
{
  "success": false,
  "error": "错误描述"
}
```

HTTP status: 400 (validation), 403 (ownership), 404 (not found), 409 (conflict), 500 (runtime).

**Extra fields**: `handleConfirm` may include extra top-level fields in the success response for downstream consumers (e.g. `registeredApp`, `updatedProfile`). These are handler-specific.

#### 9.9.2 functionCall Contract (Card Presentation)

When a handler transitions from `collect` to `confirm`, the response includes a `functionCall` field that triggers card rendering on the frontend:

```json
{
  "functionCall": {
    "name": "GM.updateAppSettings",
    "args": { "appId": "...", "changes": { "name": "..." } },
    "status": "pending"
  }
}
```

- **`name`**: The function call name. Frontend uses this to select the card component.
- **`args`**: The extracted data. These become the card's initial field values. Must match the handler's `handleConfirm` params shape — the card sends these (possibly user-edited) back on confirm.
- **`status`**: Always `"pending"` at this point. Indicates the FC awaits user confirmation.

**Card confirm flow**: User clicks confirm in the card → frontend sends `action: 'subflow_confirm'` with the (possibly modified) `args` → router dispatches to `handleConfirm(session, args, user, request)`.

#### 9.9.3 SubFlowState Mutation Rules

Handlers mutate `session.flags.subFlow` (typed as `SubFlowState`) and must call `persistSubFlowSession(session)` (from `component-runtime/subflow-persistence.ts`) after every mutation. This bridge function delegates to `persistSessionState` in `session-context.ts`, keeping SubFlow persistence aligned with the engine-wide centralization invariant — `subflow-adapter.ts` never imports `persistSession` from `engine/session` directly.

| When | Mutations | persist |
|:---|:---|:---|
| Entering handleMessage | Push `message` to `subFlow.messages` | — |
| Staying in collect (need more input) | Update `subFlow.context` if new data extracted | Yes |
| Transitioning to confirm | Set `subFlow.step = 'confirm'`; set `subFlow.extracted`; update `subFlow.context` | Yes |
| Transitioning to awaitingClientId (register) | Set `subFlow.step = 'awaitingClientId'`; set `context.awaitingClientId = true` | Yes |
| handleConfirm success | Clear: `session.flags = { ...session.flags, subFlow: undefined }` | Yes |
| handleConfirm failure | No subFlow mutation (user can retry) | No |

**Key invariant**: `subFlow.extracted` is set at the same time as `subFlow.step = 'confirm'`. The extracted data in `subFlow.extracted` must match the `functionCall.args` in the response — they represent the same data.

#### 9.9.4 Cancel Protocol

Cancel detection is handled by `routeSubFlow` in the router, **not** by individual handlers:

- Cancel patterns are **spec-driven**: loaded from `spec.lifecycle.onKeyword.patterns` via `getCancelPatterns(spec)` in `lifecycle-manager.ts`. Default fallback: `['取消', '算了', '不改了', '不要了', '不做了', '退出', 'cancel']`.
- If any pattern is found in the message, the router clears the subFlow and returns a generic cancel response.
- Handlers never see cancel messages — they are intercepted before dispatch.

#### 9.9.5 Empty/No-Data Guard

When a handler's data prerequisite is not met (e.g. no apps exist for app-settings), the handler returns a success response with a guidance message but does **not** clear the subFlow. The user can navigate away or the scene-scoped cleanup (§9.7) will eventually clear it.

---

## §10 Communication Protocol Ontology (`communication-protocol.json`)

The platform and operational ontologies (§7, §8) describe "what the world looks like" and "how the engine works". The **communication protocol** adds the third layer: "who says what to whom, and what stays hidden".

### 10.1 Schema

```json
{
  "messageTypes": {
    "<type>": {
      "sender": "pa | npc | gm | system | human",
      "channel": "public | private | system",
      "description": "中文描述",
      "metaFields": ["intent", "confidence", ...]
    }
  },
  "npcDecisionProtocols": {
    "scene_host | navigator": {
      "intentRecognition": "...",
      "dataConsumption": { "<source>": "<description>" },
      "sceneTransition": "...",
      "responseRules": ["..."]
    }
  },
  "paOutputProtocol": {
    "publicSpeech": "...",
    "goalTag": "...",
    "advisorMode": { "humanAdvice": "...", "synthesis": "..." }
  }
}
```

### 10.2 Channel Model

Three visibility tiers:

| Channel     | Visibility                                   | Examples                                   |
|-------------|----------------------------------------------|--------------------------------------------|
| `public`    | Human observers (chat UI)                    | PA speech, NPC replies                     |
| `private`   | Receiving agent only, hidden from UI         | FC results, session context, intent, scope |
| `system`    | Engine-internal, never reaches agents or UI  | Turn meta, state transitions, guard output |

### 10.3 NPC Decision Protocols

Serialized into NPC system prompt via `serializeProtocolForNPC(sceneId)` in `ontology.ts`. Selects protocol by NPC role (`navigator` for lobby, `scene_host` otherwise) and outputs structured text:

- **Intent recognition**: NPC learns it doesn't classify intents — the GM classifier does.
- **Data consumption**: Where each data type comes from (dataLoader, session-context, GM).
- **Scene transition**: NPC cannot directly transition — it guides visitors to express navigation intent.
- **Response rules**: Behavioral constraints (no fabrication, explain gated actions, redirect out-of-scope).

### 10.4 MessageEnvelope

`MessageEnvelope` extends `DualText` with sender/channel/meta fields. Internal engine uses `DualText`; conversion happens at the API boundary via `toEnvelope()` in `ontology.ts`. See `types.ts` for the full interface.

### 10.5 NPCReplyResult Metadata

`NPCReplyResult` (defined in `npc/types.ts`) carries an optional `meta` field with `scopeAssessment: 'in_scope' | 'redirect'`. This metadata flows through `generateNPCReplyForTurn` in `game-loop.ts` and is used by `process/route.ts` to construct the response `MessageEnvelope`.

**Source**: `communication-protocol.json`; `ontology.ts` (`serializeProtocolForNPC`, `toEnvelope`); `types.ts` (MessageEnvelope); `npc/types.ts` (NPCReplyResult, NPCReplyMeta)

---

## §11 PA Agent Module

The PA module (`src/lib/pa/`) implements the PA's client-facing intelligence: prompt construction, intent parsing, and auto-loop control. It bridges the dialogue chain's Stage 1–2 (Formulate + Intent, defined in `interaction-protocol.mdc`) with the engine's Stage 3–4 (GM + NPC).

The module has three files, each handling a distinct concern:

| File | Concern | Execution context |
|:-----|:--------|:------------------|
| `prompts.ts` | Prompt templates for PA formulation and PA actions | Server (via `pa-engine.ts` and `pa-respond/route.ts`) |
| `intent.ts` | Intent result parsing + deprecated frontend extraction | Server (`pa-respond/route.ts`) |
| `auto-loop.ts` | Single-step auto-mode loop control | Client (`lobby/page.tsx`) |

A closely related file, `src/lib/pa-engine.ts`, provides the SecondMe API integration layer that executes PA actions using prompts from this module. It is documented separately in §12.

---

### 11.1 Prompt System (`prompts.ts`)

Two prompt categories serve different execution paths.

#### Hub Prompts

Used by `api/gm/pa-respond` as **inline fallbacks** (external DB-stored prompts take precedence via `prompt-loader`):

| Function | Mode | Purpose | Output format |
|:---------|:-----|:--------|:--------------|
| `buildGMAutoPrompt(gmMessage, pa)` | Auto | PA responds to NPC message alone | Natural text (1–2 sentences) |
| `buildGMIntentExtractPrompt(paResponse, validIntents)` | Both | Extract intent from PA text | `{ message, actionControl }` for act/stream API |
| `buildGMExperienceDebriefPrompt(appName, pa)` | Both | Post-experience reflection | Natural text (2–3 sentences) |

Note: `pa-respond/route.ts` defines its own `FALLBACK_AUTO` and `FALLBACK_ADVISOR` prompt strings (which include ontology context injection and goal instructions) rather than using `buildGMAutoPrompt` directly. The hub prompts in `prompts.ts` serve as a shared reference and are used by other callers.

#### Action Prompts

Used by `pa-engine.ts` action executors. Each prompt takes an `AppInfo` and/or `PAContext` and returns a complete prompt string:

| Function | Action | Expected output |
|:---------|:-------|:----------------|
| `buildReviewRatingPrompt(app, pa)` | Review (step 1) | JSON: `{ overallRating, dimensions, recommendation }` |
| `buildReviewTextPrompt(app, pa, rating)` | Review (step 2) | Natural text (100–200 chars) |
| `buildVotePrompt(app, pa)` | Vote | JSON: `{ vote: "up"\|"down", reasoning }` |
| `buildDiscussPrompt(context, pa)` | Discuss | Natural text (50–150 chars) |
| `buildDiscoverPrompt(apps, pa)` | Discover | Natural text with picks |
| `buildDailyReportPrompt(activities, pa)` | Daily report | Natural text (100–200 chars) |

#### Shared Types

```ts
interface AppInfo {
  name: string
  description: string
  circleName?: string
}

interface PAContext {
  name: string
  shades: unknown      // interest tags → formatShades() outputs "你的兴趣包括：X、Y"
  softMemory?: unknown
}
```

#### Template Conventions

- All prompts open with `你是 ${pa.name}` to establish first-person voice.
- `formatShades(pa.shades)` injects persona-coloring interests. Returns empty string if no shades, so prompts degrade gracefully.
- Action prompts that require structured output (rating, vote) include explicit JSON format instructions and "不要添加其他文字" constraints.

---

### 11.2 Intent Extraction (`intent.ts`)

#### Active API

```ts
interface IntentResult {
  intent: string
  confidence: number
}

function parseIntentResult(raw: string): IntentResult
```

`parseIntentResult` safely converts a JSON string (from the act/stream API) into an `IntentResult`. On parse failure, returns `{ intent: '', confidence: 0 }` — a safe default that causes the GM classifier to fall through to keyword matching.

#### Deprecated Functions

Two functions carry `@deprecated` annotations. They were part of the v4 frontend-based intent extraction pipeline, replaced by the backend AI classifier in v5:

| Function | Original purpose | Replaced by |
|:---------|:-----------------|:------------|
| `extractValidIntents(scene)` | Extract `actIntent` fields from scene actions | Backend classifier reads scene actions directly |
| `buildIntentActionMap(scene)` | Map intents → trigger keywords | `ai-classifier.ts` + `match.ts` in engine |

These remain for backward compatibility. No active code paths call them.

#### Current Intent Extraction Pipeline

Intent extraction runs server-side in `api/gm/pa-respond` as Stage 2 of the dialogue chain:

```
PA response text + validIntents[]
  → loadActPrompt('chain.intent.extract', vars, FALLBACK_INTENT)
  → { message: paResponse, actionControl: intent prompt }
  → callSecondMeStream('/api/secondme/act/stream', ..., model: Flash)
  → JSON.parse(response) → { intent, confidence }
  → passed to GM engine for action matching
```

Skipped when `validIntents` is empty (no scene actions with `actIntent`).

**Source**: `intent.ts`; `pa-respond/route.ts` lines 152–173

---

### 11.3 Auto-Loop (`auto-loop.ts`)

Client-side control logic for auto-mode gameplay, executed in `lobby/page.tsx`. Each call to `runAutoLoopStep` drives one complete turn: PA formulates → send to GM → handle result.

#### Step Flow

```
1. Validate lastAgentMsg → error('no last agent message') if empty
2. paRespondApi(lastAgentMsg) → PA formulates response via pa-respond API
3. shouldStop() check → { type: 'stopped' } if true
4. onPaResponse(paResponse) callback → UI updates (bubble, chat history)
5. speakDelayMs(paResponse) → simulated typing pause
6. shouldStop() check
7. sendMessageApi(paResponse) → send PA text to GM process endpoint
8. shouldStop() check
9. Branch:
   a. sceneTransition present → farewell message + delay → onSceneTransition → { type: 'sceneTransition' }
   b. no transition → onNpcMessage → loop detection → { type: 'continue' }
```

#### Stop Conditions

The `shouldStop()` callback is checked after every async operation. In `lobby/page.tsx`, it returns `true` when:

- User clicked pause (`pausedRef.current`)
- Auto-loop flag cleared (`!autoLoopRef.current`) — e.g. mode switch to advisor

#### Loop Detection

A client-side guard against NPC repetition loops:

1. Caller maintains `recentNpcMessages[]` externally (cleared on scene transition, managed by `lobby/page.tsx`)
2. Each NPC message is normalized: whitespace stripped, truncated to 80 chars
3. If 2+ identical normalized messages found in recent history → `onLoopDetected()` callback + `{ type: 'error', reason: 'loop detected: repeated NPC messages' }`

This is a client-side early warning. The server has `navigator_exhaustion` (§7.6) as the backstop for navigation loops.

#### Typing Delay

Default formula: `min(text.length × 28, 2000) + 400` ms. Creates a natural reading/typing pace. Configurable via `speakDelayMs` option.

#### Result Types

```ts
type AutoLoopStepResult =
  | { type: 'sceneTransition'; transition: { from: string; to: string } }
  | { type: 'continue'; npcMessage: string }
  | { type: 'stopped' }
  | { type: 'error'; reason: string }
```

The caller (lobby `runAutoLoop`) uses the result type to decide whether to loop again (`continue`), play a transition animation (`sceneTransition`), or halt (`stopped` / `error`).

**Source**: `auto-loop.ts`; `lobby/page.tsx` lines 580–630

---

### 11.4 PA Formulation Pipeline (`api/gm/pa-respond`)

This API endpoint implements dialogue chain Stage 1 (Formulate) + Stage 2 (Intent) as a single HTTP POST.

#### Stage 1 — Formulation

1. **Prompt loading**: `loadPrompt(promptKey, vars, fallback)` queries the DB `PromptTemplate` table by key. If no active entry exists, falls back to the inline constant.
   - Advisor mode: key `chain.formulate.advisor`, fallback `FALLBACK_ADVISOR`
   - Auto mode: key `chain.formulate.auto`, fallback `FALLBACK_AUTO`

2. **Variable injection**: The prompt template uses `{varName}` placeholders, replaced by `injectVars()`:

   | Variable | Source |
   |:---------|:-------|
   | `paName` | `user.name` from auth |
   | `interests` | `formatShades(user.shades)` |
   | `npcMessage` | Request body `gmMessage` |
   | `humanAdvice` | Request body (advisor mode only) |
   | `sceneName` | `getSceneLabel(sceneId)` from platform ontology |
   | `ontologyContext` | `serializeForPA(session)` — platform map, journey, goals (§7.3) |

3. **SecondMe API call**: `callSecondMeStream('/api/secondme/chat/stream', accessToken, { message, model })`
   - Model: Sonnet for advisor (`MODEL_FOR.paFormulateAdvisor`), Flash for auto (`MODEL_FOR.paFormulateAuto`)
   - On empty response or error: random fallback from `PA_FALLBACKS` array (auto) or `'好的，我来看看……'` (advisor)

#### Goal Extraction (between Stage 1 and Stage 2)

PA's response may end with a `[GOAL: ...]` tag. The route extracts and processes it:

- Regex: `/\[GOAL:\s*(.+?)\]\s*$/`
- `"离开平台"` or contains `"离开"` → `setCurrentGoal(session, null)`
- Otherwise → `setCurrentGoal(session, { purpose, derivedFrom: gmMessage.slice(0, 80), sceneId })`
- Goal tag is stripped from PA response before returning to the caller
- Session persisted via `persistSession(session)` (pa-respond is a known route-level persist violation; tracked in `layer-boundary.test.ts`)

Goal instruction is appended to both fallback prompts via the `GOAL_INSTRUCTION` constant, which provides examples of good vs. bad goals to guide the LLM.

#### Stage 2 — Intent Extraction

See §11.2 "Current Intent Extraction Pipeline" for the detailed flow. Skipped when `validIntents` is empty.

#### Response

```json
{
  "success": true,
  "message": { "...MessageEnvelope..." },
  "paResponse": "raw PA text (goal tag stripped)",
  "intent": "matched intent or empty",
  "confidence": 0.0
}
```

The `message` field is a `MessageEnvelope` (§10.4) created via `toEnvelope()` with `sender: 'pa'`, `channel: 'public'`, and meta fields `{ intent, confidence, goal }`.

**Source**: `pa-respond/route.ts`; `prompt-loader.ts` (loadPrompt, loadActPrompt); `model-config.ts` (MODEL_FOR); `ontology.ts` (serializeForPA, toEnvelope)

---

### 11.5 PA Action Execution Engine (`pa-engine.ts`)

`src/lib/pa-engine.ts` provides the server-side execution layer for PA actions. It calls the SecondMe API with prompts from `pa/prompts.ts` and handles retries, fallbacks, and SSE stream parsing.

#### SecondMe API Integration

`callSecondMeStream(endpoint, accessToken, body)` is the core API call function:

1. Calls `callSecondMeStreamOnce` with the specified model
2. On retryable error (5xx or timeout) and if a fallback model exists → retries with `FALLBACK_FOR[model]`
3. SSE stream is parsed by `readSSEStream`: reads `data:` lines, extracts `choices[0].delta.content` or `content` or `text` fields
4. Timeout: 12 seconds via `AbortController`

#### Action Executors

Each executor dynamically imports prompts from `pa/prompts.ts`, calls the SecondMe API, and returns `PAActionResult { content: string; structured?: Record<string, unknown> }`:

| Executor | API | Model | Steps | Fallback |
|:---------|:----|:------|:------|:---------|
| `executeReviewAction` | act/stream + chat/stream | Flash | 1. Rating JSON → 2. Review text | Random 3–4 star rating + generic text |
| `executeVoteAction` | act/stream | Flash | Vote + reasoning JSON | `{ vote: 'up', reasoning: generic }` |
| `executeDiscussAction` | chat/stream | Flash | Discussion text | Generic comment |
| `executeDiscoverAction` | chat/stream | Flash | Discovery picks | Generic browsing text |
| `executeDailyReportAction` | chat/stream | Flash | Daily summary | Activity count summary |

All action executors use Flash model (speed priority for internal flows).

#### DB Logging

`logPAAction(userId, actionType, targetId, prompt, response, structured, pointsEarned)` writes to the `PAActionLog` table. Prompt and response are truncated (2000 / 5000 chars) to prevent oversized records.

**Source**: `pa-engine.ts`; `pa/prompts.ts` (prompt builders); `model-config.ts` (MODEL_FOR, FALLBACK_FOR)

---

### 11.6 Relationship to Interaction Protocol

The PA module implements the "PA" role defined in `interaction-protocol.mdc`:

| Protocol concept | PA module implementation |
|:-----------------|:------------------------|
| Stage 0: Input | Not in PA module — handled by frontend (text input / action button) |
| Stage 1: Formulate | `pa-respond/route.ts` — prompt loading + SecondMe chat/stream (§11.4) |
| Stage 2: Intent | `pa-respond/route.ts` — act/stream API with Flash model (§11.2) |
| Auto mode PA | `auto-loop.ts` client-side loop (§11.3) + auto prompt fallback (§11.1) |
| Advisor mode PA | `pa-respond/route.ts` with `humanAdvice` + Sonnet model (§11.4) |
| PA formulation model | Sonnet (advisor) / Flash (auto) — from `model-config.ts` |
| DualText convention | `pa-respond/route.ts` returns `MessageEnvelope` via `toEnvelope()` (§10.4) |

The PA module does **not** handle:

- Scene transitions (GM's responsibility via game-loop §4)
- NPC responses (NPC engine, `engine-invariants.md` §4.3)
- Action classification (AI classifier in GM, `engine-invariants.md` §4.2)
- SubFlow routing (subflow router, §9)
