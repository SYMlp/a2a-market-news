# Script Engine Specification

## §types SceneAction Interface

### Full Field List

```ts
interface SceneAction {
  id: string
  outcome: 'stay' | 'move'
  label: DualText
  triggers?: string[]
  actIntent: string
  response?: DualText
  functionCall: FunctionCall
  transition?: { type: TransitionType; target?: string }
  precondition?: { check: string; failMessage: DualText }
  params?: ParamSpec[]
}
```

### Required Fields (all actions)

| Field | Type | Description |
|:------|:-----|:-------------|
| `id` | string | Unique within the scene |
| `outcome` | 'stay' \| 'move' | Whether action stays in scene or transitions |
| `label` | DualText | Shown on UI buttons, NPC prompts, session context |
| `actIntent` | string | Intent tag for AI classifier (primary matching signal) |
| `functionCall` | FunctionCall | `{ name: string; args: Record<string, unknown> }` |

### Required for `outcome: 'move'`

| Field | Description |
|:------|:------------|
| `transition` | `{ type: 'enter_space' \| 'sub_flow' \| 'external'; target?: string }` — target scene ID for `enter_space` |

### Optional Fields

| Field | Description |
|:------|:------------|
| `triggers` | Keyword array for fallback matching when AI classifier unavailable |
| `response` | DualText template for NPC fallback when NPC AI unavailable |
| `precondition` | `{ check: string; failMessage: DualText }` — gate action availability |
| `params` | ParamSpec[] for parameterized actions |

---

## §scenes Scene Definition Format

### Scene Interface

```ts
interface SceneOpening {
  first: DualText    // shown on first visit
  return?: DualText  // shown on subsequent visits (falls back to first if omitted)
}

interface Scene {
  id: string
  opening: SceneOpening
  dataLoader?: string
  actions: SceneAction[]
  fallback: { response: DualText }
  theme: { accent: string; icon: string; label: string }
}
```

### Opening Resolution

`resolveOpening(scene, isFirstVisit)` selects the appropriate `DualText`:

- First visit (`isFirstVisit = true`) or no `return` configured → `opening.first`
- Subsequent visits → `opening.return`

First visit is determined by checking `session.flags.visitedScenes` before the scene is added. The `_help` meta-action always uses `opening.first` (it's asking "what can I do here?").

### DataLoader Pattern

- `dataLoader` — optional API path (e.g. `/api/gm/recommend`) fetched when entering scene
- Response data is merged into `session.data` for template substitution
- Used by news (recommend) and developer (developer-status) scenes

### Scene Definition Source

Scene definitions live in `specs/scenes/*.yaml` as SceneSpec files. Each YAML file declares one `Scene` object, validated against `specs/scenespec.schema.json` at load time by `src/lib/engine/scene-loader.ts`.

The scene-loader scans `specs/scenes/` on first access, validates each file with Ajv, and caches the result in memory. `getScene(id)` / `listScenes()` in `src/lib/scenes/registry.ts` consume the loader output.

### Existing Scenes (3)

| Scene | ID | Spec file | Purpose |
|:------|:---|:----------|:--------|
| **Lobby** | `lobby` | `specs/scenes/lobby.yaml` | Hub. Actions: go_news, go_developer, leave_platform |
| **News** | `news` | `specs/scenes/news.yaml` | Browse top apps, experience, report. dataLoader: `/api/gm/recommend` |
| **Developer** | `developer` | `specs/scenes/developer.yaml` | Manage apps, view feedback, register, edit. dataLoader: `/api/gm/developer-status` |

Every non-lobby scene must have a `back_lobby` action with `outcome: 'move'` and `transition: { type: 'enter_space', target: 'lobby' }`.

---

## §template Template System

### Syntax

- `{variable}` — placeholder replaced with `data[variable]`
- Regex: `/\{(\w+)\}/g`

### Substitution Rules

| Value | Result |
|:------|:-------|
| `undefined` | `''` (empty string) |
| `null` | `''` |
| `string` | As-is |
| `object` | `JSON.stringify(val)` |
| Other primitives | `JSON.stringify(val)` |

Applied to both `pa` and `agent` fields of DualText via `fillTemplate(text, data)`.

---

## §match Match Pipeline

Action resolution order (AI classifier path):

```
1. Cache (5 min TTL, max 200 entries)
   - Key: sceneId + message (trimmed, lowercased, first 200 chars)
   - Hit: return cached actionId (if not gated by precondition)
   - Miss: continue

2. AI Classifier (8s timeout)
   - Uses MODEL_FOR.actionClassify (Flash)
   - Receives: scene actions, other scenes list, session context, action constraints
   - Returns: { actionId, confidence }
   - Gated actions (precondition failed) are excluded from match
   - On timeout or error: fall through to keyword

3. Keyword Fallback
   - matchAction(actions, message): for each action, check if message includes any trigger (case-insensitive)
   - First match wins
   - Gated actions excluded

4. Free Chat
   - No action matched → actionId = '_fallback'
   - resolveTurn returns scene.fallback.response
   - NPC can respond freely and guide user toward available actions
```

---

## §strategies Three Flexibility Strategies

| Strategy | Matching | Response | Execution | When to use |
|:---------|:---------|:---------|:----------|:-------------|
| **Full template** | `triggers[]` keywords | `response` template | `functionCall` | Critical paths needing guaranteed offline behavior |
| **Intent tag** (default) | `actIntent` via AI | NPC AI generates | `functionCall` | Standard business actions |
| **Free chat** | No action matched | NPC free response | None | Exploration, chitchat |

When AI classifier is unavailable and no `triggers` are defined, the system degrades to free chat: NPC responds freely and guides the user toward available actions.

---

## §registration Scene Registration

1. Create `specs/scenes/<scene-id>.yaml` conforming to `specs/scenespec.schema.json`
2. All fields map 1:1 from the `Scene` TypeScript interface — see §scenes above
3. The scene-loader (`src/lib/engine/scene-loader.ts`) auto-discovers YAML files in `specs/scenes/` — no manual import needed
4. Add visual config in `src/lib/scene-visuals/configs.json`
5. Update `src/lib/engine/platform-ontology.json` with the new scene's NPC, capabilities, exits, and behaviors

Registry: `getScene(id)`, `listScenes()`, `buildSCENES()`. Unknown IDs fall back to lobby.
