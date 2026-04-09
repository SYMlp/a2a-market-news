# BehaviorSpec Architecture — Agent-Centric Abstraction

> **Level**: D1 (cross-cutting architectural concept)
> **Date**: 2026-03-19
> **Status**: implemented (engine, registry, 4 strategies, 2 specs)
> **Supersedes**: Deck ComponentSpec Extension plan (deck as component kind)
> **Depends on**: `component-spec-architecture.md`, `game-loop-architecture.md`, `pa-lifecycle-architecture.md`

## §1 Core Insight

ComponentSpec v1 organizes specs by **UI component type** (SubFlow form). The natural extension — adding a "deck" component kind for cards — follows the same axis: "what does the frontend render?"

A better organizing dimension is **agent behavior**: what can the agent DO? Each spec file declares one complete behavior with three projections:

- **Cognition** — what PA and NPC know about this behavior (prompt context)
- **Presentation** — what the user sees (cards, forms, lists — a consequence of the behavior, not the category)
- **Resolution** — what happens when the behavior resolves (select, collect-confirm, direct execute)

```text
ComponentSpec v1 axis:                BehaviorSpec axis:

  "What UI component?"                 "What can the agent do?"
  ├── subflow (form card)              ├── browse_apps
  └── deck (data cards)               ├── register_app
      ↑                               ├── edit_profile
      classifies by shape              └── ...
                                           ↑
                                           classifies by capability
```

Why this matters: when adding a new capability, you don't ask "do I need a form or a card?" — you ask "what does the agent do, and how does it think/show/resolve?"

### §1.1 Derivation

The insight emerged from observing that:

1. SubFlow specs already ARE behavior declarations — they define "register app" behavior, not "form card" behavior. The behavioral semantics (collect info, validate, confirm) are buried inside component-oriented fields (`collect`, `state`, `actions`).

2. Adding "deck" as a parallel component kind would create two classification axes: SubFlow behaviors live in one box, deck behaviors in another. But the real question is always behavioral: "when the agent wants to browse apps, what happens across all three layers?"

3. The user's concern about "frontend and agent logic diverging" is a symptom of component-centric design: if the spec organizes around UI, agent cognition is bolted on separately. If the spec organizes around behavior, cognition and presentation are peers in the same declaration.

## §2 BehaviorSpec Format

### §2.1 Four Sections

Every BehaviorSpec has four sections. Simple behaviors may leave some sections minimal.

```yaml
id: browse_apps
description: "浏览推荐应用并选择一个体验"

# §2.2 — WHEN is this behavior available?
availability:
  scenes: [news]
  implements: "浏览热门应用"    # references platform-ontology.capability_map key
  trigger:
    onSceneEnter: true
    onFunctionCall: GM.showApps
  preconditions: [hasApps]      # references operational-ontology.preconditions

# §2.3 — WHAT do agents know about this behavior?
cognition:
  forPA: |
    你面前有这些应用：
    {items}
    选择感兴趣的，说出名称或序号。
  forNPC: |
    展示中的应用：
    {items}
    访客提到应用时，理解为选择体验。

# §2.4 — WHAT does the user see?
presentation:
  style: card_deck
  data:
    dataLoader: /api/gm/recommend    # references operational-ontology.dataLoaders
    field: apps_json                  # which provided field to use
    itemKey: clientId
  card:
    title: '{name}'
    subtitle: '{description}'
  animation:
    enter: cascade
    idle: float

# §2.5 — WHAT happens when the behavior resolves?
resolution:
  type: select_one
  mapsTo:
    action: experience
    fc: GM.assignMission
  params:
    appName: '{name}'
    clientId: '{clientId}'
```

### §2.2 Availability

Declares when and where this behavior is active.

| Field | Type | Description |
|:------|:-----|:------------|
| `scenes` | `string[]` | Which scenes this behavior applies to |
| `implements` | `string` | Which `platform-ontology.capability_map` capability this behavior covers |
| `trigger.onSceneEnter` | `boolean` | Activate when entering the scene |
| `trigger.onFunctionCall` | `string` | Activate when this FC fires |
| `preconditions` | `string[]` | Required preconditions from `operational-ontology.preconditions`; all must be satisfied for the behavior to activate |

### §2.3 Cognition

Declares what agents know when this behavior is active. Templates use `{items}` (formatted card/item list), `{count}` (item count), and item-level `{fieldName}` placeholders.

| Field | Type | Description |
|:------|:-----|:------------|
| `forPA` | `string` | Injected into PA's prompt when behavior is active |
| `forNPC` | `string` | Injected into NPC's prompt when behavior is active |
| `forClassifier` | `string` (optional) | Additional context for the AI classifier |

This is the key differentiator from ComponentSpec v1: cognition is a first-class section, not an afterthought. When you define a behavior, you define how agents think about it.

### §2.4 Presentation

Declares the visual expression of the behavior. `style` is the dispatch key for the frontend renderer.

| Style | Description | Renders as |
|:------|:------------|:-----------|
| `card_deck` | Data-bound cards with animations | `DeckView` component |
| `form_card` | Field collection + confirm | `SpecFormCard` component (existing) |
| `list` | Simple item list | (future) |
| `map` | Spatial layout | (future) |

**Data binding** uses `dataLoader` + `field` to formally reference the data source:

| Field | Type | Description |
|:------|:-----|:------------|
| `data.dataLoader` | `string` | API route that provides the data; must match an entry in `operational-ontology.dataLoaders` |
| `data.field` | `string` | Which field in the loader's response contains the item array |
| `data.itemKey` | `string` | Unique key field within each item (used for selection resolution) |

The engine validates at load time that the referenced `dataLoader` exists in operational-ontology and provides the referenced `field`. This replaces the earlier design where `source` was a bare field name with no formal link to the data pipeline.

Presentation is a **projection** of the behavior, not its identity. Two behaviors with different cognition and resolution can share the same presentation style.

### §2.5 Resolution

Declares what happens when the behavior reaches its end state.

| Type | Description | Existing analog |
|:-----|:------------|:----------------|
| `select_one` | User picks from presented options → maps to action/FC | New |
| `subflow` | Multi-step collect → validate → confirm → execute | Existing SubFlow |
| `direct` | Immediate execution, no interaction | Existing FC execution |

## §3 Relationship to Existing Constructs

### §3.1 BehaviorSpec vs SceneAction

SceneAction is a thin behavior declaration in scene definitions:

```text
SceneAction (thin):  id, outcome, actIntent, label, functionCall, precondition
BehaviorSpec (thick): + cognition, + rich presentation, + multi-step resolution
```

BehaviorSpec is an **enrichment layer** on SceneAction. Simple actions (navigate, leave platform) don't need BehaviorSpec — SceneAction is sufficient. Complex behaviors (browse apps, register) get a BehaviorSpec that adds cognition, presentation, and resolution.

Connection: `resolution.mapsTo.action` references a SceneAction ID.

### §3.2 BehaviorSpec vs ComponentSpec v1

ComponentSpec v1 is the current implementation for SubFlow behaviors. BehaviorSpec is the architectural evolution:

| Aspect | ComponentSpec v1 | BehaviorSpec |
|:-------|:----------------|:-------------|
| Organizing axis | UI component type | Agent capability |
| Cognition | Implicit (scattered in collect/state) | Explicit first-class section |
| Presentation | Tied to component kind | Pluggable style, behavior-independent |
| Resolution | Always SubFlow pattern | Multiple types (select, subflow, direct) |

### §3.3 Migration Path

1. **New behaviors** use BehaviorSpec format from the start.
2. **Existing SubFlow specs** continue to work through the existing `subflow-adapter`. No forced migration.
3. **Parser** detects format by presence of `behavior`/`availability`/`cognition` fields → routes to behavior adapter. Absence → legacy SubFlow adapter.
4. **Optional future migration**: existing SubFlow specs can be rewritten in BehaviorSpec format when it makes sense. The `resolution.type: subflow` path would reuse existing SubFlow adapter logic.

## §4 Runtime Architecture

```text
specs/behaviors/*.yaml
  │
  ├── registry.ts — loads, validates (JSON Schema + structural), indexes by scene/trigger/ID
  │
  ├── engine.ts — orchestrator with 5 public entry points:
  │     ├── processBehavior()           → intercept message if active behavior handles it
  │     ├── buildBehaviorCognition()    → inject cognition into PA/NPC/classifier prompts
  │     ├── buildBehaviorPresentation() → provide presentation data for frontend
  │     ├── activateBehavior()          → activate a spec on the session
  │     └── deactivateBehavior()        → clean up on scene change
  │
  ├── strategies/ — dispatch by resolution.type
  │     ├── select-one.ts  — enriching: cognition + card_deck presentation
  │     ├── subflow.ts     — intercepting: delegates to existing SubFlow router
  │     ├── free-response.ts — enriching: cognition only
  │     └── navigate.ts    — enriching: cognition only
  │
  └── Integration points:
        ├── game-loop.ts         → onSceneEnter activation, deactivation on transition
        ├── fc-dispatcher.ts     → behavior execution type + post-dispatch trigger
        ├── session-context.ts   → classifier + NPC cognition injection
        ├── pa-respond/route.ts  → PA cognition injection
        └── gm/process/route.ts  → message interception + presentation serialization

Legacy ComponentSpec Runtime (unchanged, parallel path):
  specs/*.yaml → component-runtime/ → subflow-adapter.ts → SpecFormCard.tsx
```

### §4.1 Validation

BehaviorSpec YAML files are validated at two levels:

1. **Structural checks** in `registry.ts` — required fields, valid resolution types
2. **JSON Schema** via `specs/behaviorspec.schema.json` — full format enforcement including property constraints and enum values

## §5 Interaction Model

PA interacts with behavior outcomes through dialogue, not direct UI clicks:

1. Behavior activates → presentation renders (cards, form, etc.)
2. Cognition context injected into PA and NPC prompts
3. PA speaks referencing the presented content ("我选第一个")
4. AI classifier matches PA's reference to the behavior's resolution
5. Resolution executes (select item, confirm form, etc.)

This preserves the existing dialogue chain architecture (Stage 0→1→2→3→4) and the conversational nature of the platform. Presentation is visual context for the conversation, not a separate interaction path.

## §6 Catalog of Planned Behaviors

| Behavior | Scene | Resolution Type | Presentation Style | Priority |
|:---------|:------|:----------------|:-------------------|:---------|
| `browse_apps` | news | `select_one` | `card_deck` | First implementation |
| `register_app` | developer | `subflow` | `form_card` | Existing (migration candidate) |
| `edit_profile` | developer | `subflow` | `form_card` | Existing (migration candidate) |
| `app_lifecycle` | developer | `subflow` | `form_card` | Existing (migration candidate) |
| `app_settings` | developer | `subflow` | `form_card` | Existing (migration candidate) |
