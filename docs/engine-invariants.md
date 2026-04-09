# Engine Invariants — Design Rationale

This document explains **why** the engine invariants exist. For the structural rules ("what you must NOT do"), see `.cursor/rules/engine-invariants.mdc`.

---

## §1.2 Type Invariant Constraints — Binary Decision Tree

### Constraint

- **L1**: `PlayerTurn` is exactly `REST | ACT` — no third option
- **L2**: `TurnOutcome` (ACT only) is exactly `STAY | MOVE` — no third option

### Design Rationale

1. **Exhaustive resolution**: Every player input must resolve to exactly one leaf. Ambiguity would require ad-hoc handling in multiple layers (GM, NPC, frontend). A strict binary tree keeps resolution deterministic and testable.

2. **Downstream simplicity**: `resolveTurn` returns one of two outcome shapes. Route handlers and NPC logic branch on `outcome.type` only. Adding a third outcome (e.g. `DEFER`) would force every consumer to handle it, increasing coupling.

3. **Intent mapping**: PA intent extraction maps free text to `actionId`. The GM then maps `actionId` to `TurnOutcome`. A two-level tree ensures the mapping chain is short and auditable: text → actionId → stay|move.

---

## §1.3 Type Invariant Constraints — DualText

### Constraint

All user-facing text uses `DualText { pa: string; agent: string }`. Never use a plain string where DualText is expected.

### Design Rationale

1. **Dual audience**: `pa` serves the human player (natural Chinese); `agent` serves API consumers and machine logs (structured English). Collapsing to a single string would force one audience to parse the other's format.

2. **Consistent substitution**: `fillTemplate` operates on both fields. Scene `opening`, `response`, and `fallback` all carry dual content. A plain string would break the template system for one channel.

3. **Logging and audit**: `agent` text is stable and parseable for event logging and PA behavior audit. Mixing in natural language would degrade downstream analysis.

---

## §2.1 Spec-Driven Data Loading

### Constraint

Scene definitions, NPC seed data, and FC dispatch classification are loaded from declarative spec files, not hardcoded TypeScript. Three loaders enforce this boundary:

| Loader | Source | Output type | Validation |
|:-------|:-------|:------------|:-----------|
| `scene-loader.ts` | `specs/scenes/*.yaml` | `Scene` | JSON Schema (`specs/scenespec.schema.json`) via Ajv |
| `npc-loader.ts` | `specs/npcs/*.yaml` | `NPCSeedData[]` | Required field checks (key, name, emoji, role, accent, systemPrompt, scope) |
| `fc-dispatcher.ts` | `operational-ontology.json` `.execution` | `FCResult` | Type-based dispatch (builtin / subflow / handler / behavior) |
| `precondition-eval.ts` | Expression strings in SceneSpec YAML | `boolean` | Whitelist path parser (no `eval()`) |

### Design Rationale

1. **Format separation**: Scene gameplay (opening, actions, fallback, theme) is pure data — no methods, no closures. YAML is the natural format. TypeScript `Scene` interface remains the runtime contract; the loader's output type **is** `Scene`.

2. **Schema validation**: `scene-loader.ts` validates every YAML file against a JSON Schema before caching. This catches typos, missing fields, and structural errors at load time rather than at runtime during a player interaction.

3. **Auto-discovery**: Both loaders scan their directory on first access and cache results. No manual import/registration step. Adding a new scene or NPC means creating a YAML file — the engine picks it up automatically.

4. **Ontology-driven dispatch**: The `execution` field in `operational-ontology.json` classifies each FC into one of four types (builtin, subflow, handler, behavior). `fc-dispatcher.ts` reads this classification and routes accordingly, eliminating the switch/case in the old `function-call-executor.ts`.

5. **Expression DSL for preconditions**: `precondition-eval.ts` parses a small expression language (`session.flags.xxx == true`, `&&`, `||`, `!`) instead of relying on hardcoded string-to-function mappings. The parser is a whitelist of path access + comparison operations — no `eval()`, no injection risk.

### What You Must NOT Do

- Hardcode scene definitions in TypeScript — all scene data goes in `specs/scenes/*.yaml`
- Hardcode NPC seed data in TypeScript — all NPC specs go in `specs/npcs/*.yaml`
- Add switch/case branches in FC execution — register the FC's `execution` type in `operational-ontology.json`
- Use `eval()` or `Function()` for precondition expressions — use the whitelist parser in `precondition-eval.ts`
- Bypass the schema validation in `scene-loader.ts` — if a field is missing, fix the YAML, don't skip validation

---

## §2.2 NPC Scope — Ontology-Driven Model (v7)

### Constraint

NPC scope is enforced via **platform ontology injection** into the NPC system prompt. The ontology (`platform-ontology.json`) is serialized by `serializeForNPC(sceneId)` and appended to the NPC's system prompt, providing:

- The NPC's own capabilities
- Scene exit topology (which exits exist)
- Other scenes' capabilities and how to reach them
- Navigation rules ("场景之间不能直达，必须经过大厅")
- Capability map (visitor desires → target scene, helps NPC redirect)

### Design Rationale

1. **Ontology replaces keyword matching**: The previous two-layer model (runtime keyword gate + prompt constraint) suffered from a structural flaw: the runtime gate intercepted **navigation intents** (e.g. PA saying "去开发者空间") as "out of scope", even when the NPC itself had just suggested that action. The ontology approach gives NPC the full map, so it naturally knows what it handles and what to redirect — without brittle keyword matching.

2. **Self-consistent navigation**: NPC sees its own exits and the topology rules. It will never suggest "去开发者空间" from the news scene — instead it says "回大厅后可以去开发者空间". This eliminates the contradiction where NPC suggests an unreachable destination.

3. **Single source of truth**: `platform-ontology.json` defines the world model once. NPC prompts, PA prompts, and future tooling all derive from it. No more parallel maintenance of `scope[]` arrays, `SCENE_LABELS` maps, and `buildNavigatorContext` logic.

4. **Cost trade-off**: v7 trades a small increase in prompt tokens (~200-300 tokens for ontology text) for eliminating all hard-gate scope check calls and their associated false positives. The net latency is comparable because the scope gate was only skipping AI for wrongly-intercepted messages.

### Evolution from v6

| Aspect | v6 (Two-Layer) | v7 (Ontology) |
|:---|:---|:---|
| Scope enforcement | Runtime keyword gate (hard) + prompt constraint (soft) | Ontology in prompt (soft, with full context) |
| Navigation awareness | None — NPC didn't know topology | Full topology + exits + cross-scene capabilities |
| False positives | High — "去开发者空间" blocked as out-of-scope | Eliminated — NPC has the map |
| Code complexity | `scope.ts` (80 lines) + `session-context.ts buildNavigatorContext` (80 lines) | `ontology.ts serializeForNPC` (~30 lines) + JSON |

### Safety net

The `conversation-guard.ts` (NPC repetition detection + cross-scene loop detection + same-scene action repeat detection) remains as the last-resort circuit breaker. If the ontology-informed NPC somehow enters a loop, the guard fires. The v9 action repeat detector catches loops where the NPC text varies (evading the NPC-message guard) but the same FC fires repeatedly.

---

## §2.3 Operational Ontology — FC Context Enrichment

### Constraint

Function call results presented to NPC must go through `describeFCForNPC(fcResult)` in `ontology.ts`, which combines the **operational ontology** registry (`operational-ontology.json`) with the actual `FCResult`. Raw FC names or bare status strings must not be passed to NPC prompts.

### Design Rationale

1. **Semantic context for NPC**: Bare strings like `"GM.assignMission 执行成功"` give the NPC no context about what happened, what the effect was, or what to tell the visitor next. The operational ontology provides `label`, `produces`, `failHint`, `npcHint`, and `sideEffects` — enabling the NPC to give accurate follow-up guidance.

2. **Dual-purpose metadata**: The operational ontology now serves two roles. The `label`, `produces`, `failHint`, `npcHint`, `sideEffects` fields remain **read-only prompt enrichment** consumed by `describeFCForNPC`. The `execution` field is **dispatch metadata** consumed by `fc-dispatcher.ts` to route FCs to the correct handler type (builtin / subflow / handler / behavior). Execution logic itself (DB writes, session mutations) lives in registered effect handlers, not in the ontology.

3. **Graceful degradation**: If an FC name is not in the operational ontology (e.g. a newly added FC before the registry is updated), `describeFCForNPC` falls back to the bare status format. No crash, no missing context — just reduced richness.

4. **Scene label unification**: `getSceneLabel(sceneId)` from `ontology.ts` is the single source of truth for human-readable scene names, derived from `platform-ontology.json`. All hardcoded `SCENE_LABELS` / `SCENE_NAMES` maps have been eliminated.

---

## §3.1 MessageEnvelope — API Boundary Protocol

### Constraint

`MessageEnvelope` extends `DualText` with `sender`, `channel`, and optional `meta`. Internal engine functions (`resolveTurn`, `fillTemplate`, `conversation-guard`) continue to use `DualText`. The conversion to `MessageEnvelope` happens **only at the API boundary** via `toEnvelope()` in `ontology.ts`, called from `process/route.ts` and `pa-respond/route.ts`.

### Design Rationale

1. **Backward compatibility**: `MessageEnvelope extends DualText` means all existing code that reads `msg.pa` and `msg.agent` works unchanged. No migration required for scene definitions, template engine, or conversation guard.

2. **Metadata provenance**: NPC replies carry `meta.scopeAssessment` from `NPCReplyResult`; PA replies carry `meta.intent`, `meta.confidence`, `meta.goal`. This metadata originates at the producing agent and flows to the API response without the route handler reconstructing it from booleans.

3. **Channel visibility**: Three tiers (`public`, `private`, `system`) formalize what was previously implicit. Frontend reads `public` channel messages; `private` metadata (FC results, scope assessment) is available to agents but filtered from UI; `system` messages never leave the engine.

4. **Single conversion point**: `toEnvelope()` is pure — it spreads `DualText` and adds protocol fields. No side effects, no DB calls. This keeps the boundary clean and testable.

### What You Must NOT Do

- Return a raw `DualText` from API routes — always wrap with `toEnvelope()`
- Use `MessageEnvelope` inside engine internals (keep them on `DualText`)
- Add fields to `MessageEnvelope` that don't derive from the communication protocol ontology

---

## §4.2 AI Classifier Matching Pipeline

### Constraint

Order: **cache (5 min, 200 entries)** → **AI (8s timeout)** → **keyword fallback** → **free chat**.

### Design Rationale

1. **Cache**: Repeated or similar messages (e.g. "去日报栏" in lobby) hit cache. Avoids redundant AI calls. 5 min TTL balances freshness vs. cost. 200-entry cap prevents unbounded growth. Pruning: remove oldest entries when over limit.

2. **AI classifier**: Primary path for natural language. Receives full scene context (actions + other scenes) so it can route cross-scene intents (e.g. "注册" in news → `back_lobby`, not `experience`). 8s timeout: if AI is slow or unavailable, fall through to keyword instead of blocking the user.

3. **Keyword fallback**: When AI times out, errors, or access token is missing. `matchAction` checks `message.toLowerCase().includes(trigger.toLowerCase())` for each action's `triggers`. First match wins. Ensures offline-like behavior for critical paths that define `triggers`.

4. **Free chat**: No match → `_fallback`. `resolveTurn` returns `scene.fallback.response`. NPC can respond freely and guide the user. Rationale: better to have a helpful NPC reply than a generic "intent unclear" when the user is exploring.

5. **Gated actions**: Precondition-failed actions are excluded from both AI and keyword match. Prevents matching an action the user cannot execute (e.g. `report` without `hasExperienced`).

---

## §4.3 NPC Degradation Chain (v7)

### Constraint

When generating an NPC reply, the system degrades in this order:

1. **Owner token** — no NPC owner, inactive NPC, or token refresh failed → template fallback
2. **AI generation** — call `callSecondMeStream` with owner's token; system prompt includes ontology context
3. **Post-processing** — `stripLLMTags(aiReply)` removes LLM internal tags (`<think>`, `<thinking>`, `<thought>`, `<final>`) and markdown thinking blocks before the reply reaches the user
4. **Template fallback** — on AI error, empty response, or empty post-strip result → `outcome.message`, `resolveOpening(scene, isFirstVisit)`, or `scene.fallback.response`
5. **Conversation guard** — if NPC reply is repetitive (3+ similar replies) or same action fires 3+ times in same scene, override with circuit-breaker message

### Changes from v6

The **scope redirect** step was removed from the degradation chain in v7. Previously, `checkScopeAndRedirect` intercepted out-of-scope messages before AI generation. This caused false positives on navigation intents (see §2.2). Scope awareness is now embedded in the NPC's system prompt via the platform ontology.

### Design Rationale

1. **Owner token**: NPCs can be bound to a SecondMe user (owner). That user's PA intelligence powers the NPC. If there is no owner, the NPC is inactive, or the token cannot be refreshed, we cannot call the chat API. Fallback to template ensures the user always gets a response.

2. **AI generation with ontology**: The system prompt now includes `serializeForNPC(sceneId)` — the NPC's capabilities, exits, other scenes' capabilities, and navigation rules. This replaces the old `buildScopeConstraint` one-liner with a complete world model. The NPC naturally handles scope through context rather than keyword gates.

3. **Post-processing (`stripLLMTags`)**: Some LLM models emit internal reasoning tags (`<think>`, `<thinking>`) or markdown thinking blocks in their output. `stripLLMTags` in `src/lib/ux/tag-stripper.ts` strips these before the reply reaches the user. If the cleaned reply is empty, the fallback path activates.

4. **Template fallback**: When AI fails (network, timeout, API error), the template provides a deterministic, scene-appropriate message. Priority: `outcome.message` (from matched action) > `resolveOpening(scene, isFirstVisit)` (for scene entry, choosing first/return template based on `visitedScenes`) > `scene.fallback.response` (for free chat). This keeps the conversation coherent even when AI is unavailable.

4. **No silent failure**: Every path returns a DualText. The user never sees a blank or error message. Degradation is graceful and predictable.
