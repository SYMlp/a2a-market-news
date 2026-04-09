# Ontology Architecture — Three-Layer Agent Cognition Model

This document describes the top-level design of the platform's agent cognition system. It is the architectural reference for understanding how agents (PA, NPC, GM) perceive the world, communicate with each other, and make decisions. Other design docs describe subsystem implementations; this doc describes the overarching model that governs all of them.

**Validation use**: When reviewing code changes, check against this document to verify that the change does not violate layer boundaries, channel visibility rules, or the single-source-of-truth principle.

---

## §1 Design Problem

The platform has three agent types (PA, NPC, GM) that need to cooperate. Each agent must:

1. **Know the world** — what scenes exist, what capabilities are available, how to navigate
2. **Operate the machinery** — what services to call, what data to expect, what side effects occur
3. **Communicate appropriately** — what to say publicly, what to pass privately between agents, what stays engine-internal

Before the ontology architecture, this knowledge was scattered: hardcoded maps in TypeScript, ad-hoc text injection into prompts, implicit conventions in switch statements. Adding a scene or FC required updating 5+ files with no single reference for what needed changing.

The ontology architecture solves this with three JSON registries (the "ontology layers") and a structured message format (MessageEnvelope) that makes visibility explicit.

---

## §2 Three-Layer Model

```text
Layer 3: Communication Protocol    "who says what to whom"
    communication-protocol.json
    ─────────────────────────────────────
Layer 2: Operational Ontology       "how the engine works"
    operational-ontology.json
    ─────────────────────────────────────
Layer 1: World Ontology             "what the world looks like"
    platform-ontology.json
```

### §2.1 Layer 1 — World Ontology (`platform-ontology.json`)

**Scope**: The public, observable world model. What a visitor or external observer would see.

**Contains**:

- Scene graph: IDs, labels, NPC names, roles, capabilities, exit topology
- Topology rules: navigation constraints ("must go through lobby")
- Capability map: visitor desires → target scene

**Consumed by**:

- `serializeForNPC(sceneId)` — NPC system prompt (scene-anchored view)
- `serializeForPA(session)` — PA prompt (journey-aware view)
- `getSceneLabel(sceneId)` — everywhere that needs a human-readable scene name

**Design principle**: This layer is the single source of truth for "what the world looks like". No hardcoded `SCENE_LABELS`, `SCENE_NAMES`, or `SCENE_THEMES` maps should exist elsewhere. If code needs a scene label, it calls `getSceneLabel()`.

### §2.2 Layer 2 — Operational Ontology (`operational-ontology.json`)

**Scope**: The internal machinery. How the engine executes actions, what data flows where, what preconditions gate actions.

**Contains**:

- FC registry: 13 function calls with label, scene, category, requires, produces, failHint, npcHint, sideEffects. SubFlow-type FCs may include a `validation` object describing programmatic verification gates (e.g. `GM.startRegistration` specifies API-based activation word verification)
- DataLoader registry: 2 endpoints with scene binding, provided fields, semantic meaning
- Precondition semantics: 4 checks with human-readable meaning and what they unlock

**Consumed by**:

- `describeFCForNPC(fcResult)` — enriches FC results for NPC context
- `isNavigationFC(name)` — derived from `category: "navigation"` entries
- `getOperationalOntology()` — direct access for any consumer that needs FC semantics

**Design principle**: This layer is a read-only metadata registry. It describes execution semantics but does NOT replace execution logic. The `executeFunctionCall` switch statement in `process/route.ts` remains the authoritative execution path. Raw JSON from this layer is never injected into prompts — always through serializer functions.

### §2.3 Layer 3 — Communication Protocol (`communication-protocol.json`)

**Scope**: The rules of agent-to-agent communication. What message types exist, who can see them, how each agent role should process incoming information.

**Contains**:

- Message types: each with sender, channel, description, expected metadata fields
- NPC decision protocols: per-role frameworks for intent recognition, data consumption, response rules, scene transition knowledge
- PA output protocol: structured output format, goal tagging, advisor mode behavior

**Consumed by**:

- `serializeProtocolForNPC(sceneId)` — injects decision framework into NPC prompt
- `toEnvelope()` — constructs MessageEnvelope at API boundary
- Validation: reviewers check code against protocol definitions

**Design principle**: This layer defines communication contracts. Agents receive context through well-defined channels, not ad-hoc text injection. When NPC needs to know "what data do I have and where did it come from", the protocol tells it — the NPC does not need to reverse-engineer the session context format.

---

## §3 Channel Visibility Model

Three tiers of message visibility, enforced by `MessageChannel` type:

| Channel   | Who sees it                 | Examples                                                   | Storage                          |
| :-------- | :-------------------------- | :--------------------------------------------------------- | :------------------------------- |
| `public`  | Human observer + all agents | PA speech, NPC replies                                     | Chat UI, event log               |
| `private` | Receiving agent only        | FC results, session context, intent metadata, human advice | Prompt injection, not in chat UI |
| `system`  | Engine internal only        | Turn meta, state transitions, guard decisions              | Internal state, logs             |

### §3.1 Channel Flow by Stage

The dialogue chain has 5 stages. Each stage produces and consumes specific channels:

| Stage         | Producer | Public output | Private output             | System output                        |
| :------------ | :------- | :------------ | :------------------------- | :----------------------------------- |
| 0: Input      | Human    | —             | advice to PA               | —                                    |
| 1: Formulate  | PA       | speech text   | intent + goal + confidence | —                                    |
| 2: Intent     | System   | —             | classified actionId        | classifier source (ai/keyword/cache) |
| 3: GM Resolve | GM       | —             | FC result for NPC          | turn outcome, state mutations        |
| 4: NPC Reply  | NPC      | reply text    | scope assessment           | —                                    |

### §3.2 GM as Visibility Mediator

The GM engine sees all three channels. Its mediation responsibilities:

1. **Public → Frontend**: Only `channel: 'public'` messages reach the chat UI
2. **Private → Agent prompts**: FC results, session context, and protocol guidance are injected into NPC/PA prompts but never shown to the human
3. **System → Logs**: Turn metadata, guard decisions, and state transitions are logged but never leave the engine
4. **Human advice → PA only**: In advisor mode, the human's advice is injected into the PA prompt but explicitly excluded from the NPC prompt (PA must not reveal the advisor's existence)

---

## §4 Agent Cognition Model

Each agent type has a defined cognitive scope — what it knows, what it receives, and what it produces.

### §4.1 PA (Player Agent)

| Aspect              | Source                                                                                |
| :------------------ | :------------------------------------------------------------------------------------ |
| Knows the world     | Layer 1 via `serializeForPA(session)` — full map, visit history, goal, return context |
| Knows its identity  | SecondMe profile (name, shades, soft memory)                                          |
| Receives from NPC   | Public reply text (via GM relay)                                                      |
| Receives from Human | Private advice (advisor mode only)                                                    |
| Produces (public)   | Natural language speech (1-2 sentences)                                               |
| Produces (private)  | `[GOAL: ...]` tag, intent, confidence                                                 |

PA does NOT know: FC execution details, session flags internals, NPC system prompts, operational ontology.

### §4.2 NPC (Scene Host / Navigator)

| Aspect              | Source                                                                                   |
| :------------------ | :--------------------------------------------------------------------------------------- |
| Knows the world     | Layer 1 via `serializeForNPC(sceneId)` — own capabilities, exits, other scenes, topology |
| Knows the machinery | Layer 2 via `describeFCForNPC()` — semantic FC results, not raw engine state             |
| Knows the protocol  | Layer 3 via `serializeProtocolForNPC()` — decision framework, data consumption rules     |
| Receives from PA    | Public speech (via GM relay), classified intent (via session context)                    |
| Receives from GM    | Session context (private), FC result (private), action constraints (private)             |
| Produces (public)   | Reply text in character                                                                  |
| Produces (private)  | Scope assessment (in_scope / redirect)                                                   |

NPC does NOT know: raw session flags, PA's SecondMe profile, human advisor existence, other NPC prompts.

### §4.3 GM (Game Master Engine)

| Aspect                | Source                                                                                |
| :-------------------- | :------------------------------------------------------------------------------------ |
| Knows everything      | All three ontology layers, full session state, all agent outputs                      |
| Mediates visibility   | Filters channels for each consumer (frontend, NPC prompt, PA prompt)                  |
| Executes side effects | `executeFunctionCall` switch statement — DB writes, notifications, subflow activation |
| Constructs envelopes  | Wraps DualText into MessageEnvelope at API boundary                                   |

GM is not an LLM agent — it is deterministic engine code. The AI classifier within GM uses LLM, but the GM's own decisions (match action, resolve turn, apply result) are code-based.

---

## §5 Behavior Integration

BehaviorSpec (`behavior-spec-architecture.md`) cross-cuts all three ontology layers. Where each layer defines a single dimension (world, machinery, communication), a behavior binds fragments from all three into one coherent agent capability. This section documents the formal edges between the ontology and the behavior system.

### §5.1 Cross-Layer References

Each BehaviorSpec declares three inbound references to the ontology:

```text
platform-ontology.json                  BehaviorSpec                   operational-ontology.json
┌──────────────────────┐              ┌──────────────┐              ┌──────────────────────┐
│ capability_map       │◄─implements──│ availability │──preconditions──►│ preconditions       │
│ scenes[].behaviors   │              │              │              │                      │
└──────────────────────┘              │ presentation │──dataLoader──►│ dataLoaders          │
                                      └──────────────┘              └──────────────────────┘
```

| Reference | From (BehaviorSpec) | To (Ontology) | Validates |
|:----------|:--------------------|:--------------|:----------|
| `availability.implements` | capability name | `platform-ontology.capability_map` key | The behavior covers an actual platform capability |
| `availability.preconditions` | precondition IDs | `operational-ontology.preconditions` keys | Activation guards are formally defined |
| `presentation.data.dataLoader` | API route | `operational-ontology.dataLoaders` key | The data source exists and provides the referenced field |

### §5.2 Ontology Awareness of Behaviors

The ontology layers gain backward references to the behavior system:

- **Layer 1** (`platform-ontology.json`): Each scene entry has a `behaviors` map — capability name → BehaviorSpec ID (or `null` for uncovered capabilities). This makes behavior coverage gaps visible at the ontology level.
- **Layer 2** (`operational-ontology.json`): Each FC entry has a `behaviorPattern` field — the resolution type (`select_one`, `subflow`, `free_response`, `navigate`) that describes how the FC participates in behavioral interactions.
- **Layer 3** (`communication-protocol.json`): The `behavior_context` message type formalizes the information channel through which the behavior engine injects cognition context (active behavior data and guidance) into agent prompts.

### §5.3 Knowledge Graph Model

The behavior integration creates a formal knowledge graph across the ontology:

**Entities**: Scene, Capability, BehaviorSpec, FC, DataLoader, Precondition

**Edges**:

| Edge | From | To | Meaning |
|:-----|:-----|:---|:--------|
| `implements` | BehaviorSpec | Capability | "this behavior covers this capability" |
| `preconditions` | BehaviorSpec | Precondition | "this behavior requires these conditions" |
| `dataLoader` | BehaviorSpec.presentation | DataLoader | "this behavior's data comes from here" |
| `behaviors` | Scene | BehaviorSpec | "this scene hosts these behaviors" |
| `behaviorPattern` | FC | resolution type | "this FC participates in this interaction pattern" |
| `behavior_context` | System | Agents | "behavior engine injects context through this channel" |

### §5.4 Why Presentation Is Not Layer 4

Presentation is a behavior-level concern, not a system-level ontology layer. The three ontology layers describe universal truths about the platform:

- Layer 1: what the world **is** (scenes, capabilities, topology) — shared by all agents, all behaviors
- Layer 2: how the engine **works** (FCs, data loaders, preconditions) — shared by all operations
- Layer 3: how agents **communicate** (message types, channels, protocols) — shared by all interactions

Presentation describes how a **specific behavior** visually expresses itself to the user. Different behaviors in the same scene can have different presentation styles (cards, forms, lists). The same behavior could theoretically have different presentations on different platforms. Presentation is a projection of a single behavior instance, not a structural property of the world.

If presentation were an ontology layer, it would need to be injected into every agent prompt alongside the other layers. But agents don't need to know about card animations or deck layouts — they need cognition context (what items exist, how to reference them). The `behavior_context` message type carries exactly this cognitive payload without exposing visual implementation details.

---

## §6 MessageEnvelope Architecture

### §6.1 Type Hierarchy

```text
DualText { pa: string; agent: string }
    ↑ extends
MessageEnvelope { sender, channel, meta? }
```

`DualText` remains the internal content type used by scene definitions, templates, and the conversation guard. `MessageEnvelope` wraps DualText at the API boundary with protocol metadata.

### §6.2 Backward Compatibility Contract

The frontend reads `data.message?.pa` to display text. This contract is preserved: `MessageEnvelope extends DualText`, so `.pa` is always present. The frontend does not need to understand `sender`, `channel`, or `meta` — those are consumed by the engine and agent prompts.

### §6.3 Boundary Conversion

Internal engine functions return `DualText`. The `toEnvelope()` helper converts at two boundary points:

- `process/route.ts` — GM wraps the final NPC reply (or guard override) into a MessageEnvelope
- `pa-respond/route.ts` — PA wraps its response with intent/confidence/goal metadata

This keeps the conversion localized. Adding MessageEnvelope does not require changing scene definitions, templates, or guard logic.

---

## §7 Single-Source-of-Truth Principle

Every piece of world knowledge should have exactly one authoritative source. When code needs information, it should read from that source — not from a local copy.

| Information                | Authoritative source                                 | Anti-pattern                     |
| :------------------------- | :--------------------------------------------------- | :------------------------------- |
| Scene label (human name)   | `platform-ontology.json` via `getSceneLabel()`       | Hardcoded `SCENE_LABELS` map     |
| NPC name per scene         | `platform-ontology.json` `scenes[id].npc`            | Hardcoded NPC name lookup        |
| FC is navigation type      | `operational-ontology.json` `category: "navigation"` | Hardcoded `NAVIGATION_FCS` set   |
| Capability → scene mapping | `platform-ontology.json` `capability_map`            | Ad-hoc `if` chains               |
| NPC behavior rules         | `communication-protocol.json` `npcDecisionProtocols` | Duplicated in system prompt text |
| Agent behavior declarations | BehaviorSpec YAML via behavior-engine registry        | Hardcoded handler logic          |

---

## §8 Validation Checklist

When reviewing a code change, check:

1. **Layer boundary**: Does the change respect which layer owns the data? (e.g., adding a new FC → update `operational-ontology.json`, not a hardcoded constant)
2. **Channel visibility**: Does the change ensure private data stays private? (e.g., FC execution details should not appear in chat UI)
3. **Single source of truth**: Does the change introduce a new hardcoded map that duplicates an ontology? (e.g., new `SCENE_NAMES` constant)
4. **Boundary conversion**: If the change touches API response construction, does it use `toEnvelope()` instead of raw DualText?
5. **NPC cognition scope**: Does the NPC receive only what it should know? (e.g., NPC should not see human advisor text)
6. **Backward compatibility**: Does the frontend still work by reading `.pa`?
7. **Behavior coverage**: Does the new behavior reference a `platform-ontology` capability? Does its `availability` include the correct preconditions from `operational-ontology`?

---

## §9 Relationship to Other Design Docs

| Document                                                     | Relationship                                                                                                              |
| :----------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| [game-loop-architecture.md](game-loop-architecture.md)       | Describes the 4-stage loop that this ontology feeds into. Dialogue chain stages map to §3.1 channel flow.                 |
| [pa-lifecycle-architecture.md](pa-lifecycle-architecture.md) | Describes session context projection (the "bridge" between engine and AI). §7-8 describe ontology implementation details. |
| [engine-invariants.md](engine-invariants.md)                 | Describes WHY specific invariants exist. §2.2-2.3 cover ontology-driven scope and FC context enrichment.                  |
| [script-engine-spec.md](script-engine-spec.md)               | Describes scene definitions that use DualText (Layer 1 content). Scene actions reference FCs described in Layer 2.        |
| [behavior-spec-architecture.md](behavior-spec-architecture.md) | Declares agent behaviors that cross-cut all three layers. §5 describes the integration model.                             |
| `.cursor/rules/engine-invariants.mdc`                        | The operational constraints derived from this architecture (WHAT you must not do).                                        |
| [system-ontology-manifest.yaml](system-ontology-manifest.yaml) | Meta-schema for all entity and edge types across the three ontology layers. Defines validation rules.                     |
| `.cursor/rules/ontology-sync.mdc`                            | Sync enforcement: triggers, update matrix, and validation checklist for ontology changes.                                 |

**Source files**: `ontology.ts`, `platform-ontology.json`, `operational-ontology.json`, `communication-protocol.json`, `types.ts` (MessageEnvelope), `session-context.ts` (context projection)

---

## §10 System Ontology Manifest

The three ontology layers (§2) and the behavior system (§5) together define 10 entity types and 14 edge types. As the system grew, a gap emerged: no single place answered "what entity types exist across the ontology, where is each type's authoritative source, and what edges connect them". The System Ontology Manifest fills this gap.

### §10.1 What the Manifest Is

`docs/system-ontology-manifest.yaml` is a **meta-schema** — it defines the types and edges that the ontology layers contain, without duplicating instance data. The manifest answers three questions:

1. **What entity types exist?** — 10 types (Scene, NPC, Capability, FunctionCall, DataLoader, Precondition, MessageType, BehaviorSpec, BehaviorPattern, PresentationStyle), each with its authoritative source file, instance location path, and identifier field.
2. **What edge types connect them?** — 14 edges (e.g., `has_npc` from Scene to NPC, `behavior_implements` from BehaviorSpec to Capability), each with source/target entity types, declaration location, and field path.
3. **What validation rules apply?** — 10 referential integrity constraints (e.g., "every FC's scene reference must be a valid Scene ID") with severity levels (error, warning, info).

### §10.2 Schema vs Data

The manifest is strictly a schema. Instance data stays in the three JSON files and BehaviorSpec YAMLs. The manifest does not duplicate scene lists, FC definitions, or behavior declarations — it only declares that these entity types exist and where to find them. This prevents a data synchronization problem: if the manifest held instance data, it would need updating every time a scene or FC changed.

### §10.3 Sync Governance

The `.cursor/rules/ontology-sync.mdc` rule enforces that changes to ontology source files trigger a sync check against the manifest. The rule defines:

- **Trigger events**: which file changes require ontology sync verification
- **Update matrix**: which ontology files need updating for each type of change
- **Validation checklist**: referential integrity checks that must pass after changes

This closes the governance gap identified in §1 — previously, only Scene additions had an explicit sync rule (in `npc-authoring.mdc`), while other entity types had no enforcement.
