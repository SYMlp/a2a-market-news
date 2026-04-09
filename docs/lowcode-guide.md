# Low-Code Development Guide

How to extend the A2A 智选日报 engine by writing YAML spec files — no TypeScript required for most additions.

---

## What You Can Do Without Code

| Operation | How | Needs code? |
|:----------|:----|:------------|
| Add a new scene | Write `specs/scenes/<id>.yaml` | No |
| Add a new NPC | Write `specs/npcs/<key>.yaml` | No |
| Add a navigation / display FC | Add entry in `operational-ontology.json` with `execution.type: builtin` | No |
| Add a SubFlow FC | Add entry in `operational-ontology.json` with `execution.type: subflow` | No (needs a ComponentSpec YAML) |
| Add a precondition | Write expression in SceneSpec YAML `precondition.check` | No |
| Add a BehaviorSpec | Write `specs/behaviors/<id>.yaml` | No |

**Still needs code:**

- Business FC with custom logic (e.g. DB writes) → implement an effect handler and register in `handler-registry.ts`
- New BehaviorSpec resolution strategy → implement in `behavior-engine/strategies/`

---

## 1. Creating a New Scene

### Step 1: Write the SceneSpec YAML

Create `specs/scenes/<scene-id>.yaml`. The file is auto-discovered by the engine at startup.

```yaml
id: marketplace
theme:
  accent: purple
  icon: "🛒"
  label: 应用市场

opening:
  first:
    pa: "欢迎来到应用市场！这里可以浏览和购买应用。"
    agent: "Marketplace scene. Browse and purchase apps."
  return:
    pa: "又来逛市场了！有什么想找的？"
    agent: "Returning to marketplace."

dataLoader: /api/gm/marketplace-data   # optional: API endpoint fetched on scene entry

actions:
  - id: browse
    outcome: stay
    label:
      pa: 浏览应用
      agent: Browse apps
    actIntent: browse
    functionCall:
      name: GM.showApps
      args: {}

  - id: purchase
    outcome: stay
    label:
      pa: 购买应用
      agent: Purchase an app
    actIntent: purchase
    response:
      pa: "正在处理购买..."
      agent: "Processing purchase..."
    functionCall:
      name: GM.purchaseApp
      args: {}
    precondition:
      check: "session.data.hasBalance == true"
      failMessage:
        pa: "余额不足，无法购买。"
        agent: "Insufficient balance."

  - id: back_lobby
    outcome: move
    label:
      pa: 回到大厅
      agent: Return to lobby
    actIntent: leave
    functionCall:
      name: GM.enterSpace
      args:
        space: lobby
    transition:
      type: enter_space
      target: lobby

fallback:
  response:
    pa: "没太听清——你是想浏览应用还是购买？"
    agent: "Intent unclear. Available: browse, purchase, back to lobby."
```

### Step 2: Update the platform ontology

Add the scene to `src/lib/engine/platform-ontology.json` so NPCs know about it:

```jsonc
{
  "scenes": {
    "marketplace": {
      "label": "应用市场",
      "npc": "商店小助手",
      "capabilities": ["浏览应用", "购买应用"],
      "exits": ["lobby"],
      "behaviors": {
        "浏览应用": null,
        "购买应用": null
      }
    }
    // ... existing scenes need "marketplace" added to their exits if reachable
  }
}
```

Also add `"marketplace"` to `lobby.exits[]` so players can navigate there.

### Step 3: Add visual config

Add an entry in `src/lib/scene-visuals/configs.json`:

```jsonc
{
  "marketplace": {
    "accent": "purple",
    "accentRgb": "128, 0, 128",
    "agentName": "商店小助手",
    "agentEmoji": "🛒",
    "npcSkin": "shop",
    "label": "应用市场",
    "icon": "🛒",
    "npcGreeting": "欢迎来到应用市场！",
    "bgParticleCount": 30,
    "transitionIn": "slide-left",
    "transitionOut": "slide-right"
  }
}
```

### Step 4: Create the scene's NPC

See section 2 below.

### Checklist

- [ ] `specs/scenes/<id>.yaml` created and valid
- [ ] Every non-lobby scene has a `back_lobby` action with `outcome: move`
- [ ] `platform-ontology.json` updated (npc, capabilities, exits, behaviors)
- [ ] Connected scenes' `exits[]` updated to include the new scene
- [ ] Visual config added in `configs.json`
- [ ] NPC spec created in `specs/npcs/`
- [ ] If scene has a `dataLoader`, the API endpoint exists

---

## 2. Creating a New NPC

### Write the NPC Spec YAML

Create `specs/npcs/<npc-key>.yaml`:

```yaml
key: shop-assistant
name: 商店小助手
emoji: "🛒"
role: scene_host       # 'gm' for the global GM, 'scene_host' for scene-bound NPCs
sceneId: marketplace   # which scene this NPC hosts (null for global NPCs like GM)
accent: "#9b59b6"
scope: [应用, 购买, 浏览, 推荐]

systemPrompt: |
  你是「商店小助手」，应用市场的主持人。

  你的性格：热情、专业、乐于推荐好应用。

  你的职责：
  - 向访客推荐平台上的应用
  - 帮助访客购买感兴趣的应用
  - 回答关于应用的问题

  你不负责的事：
  - 应用开发和管理 → 引导访客"回大厅去开发者空间"
  - 平台整体介绍 → 引导访客"回大厅找灵枢兔"

  语气要求：像一个懂行的导购，热情但不过分推销。
```

### Required fields

| Field | Type | Description |
|:------|:-----|:------------|
| `key` | string | Unique identifier. **Must not change after deployment.** |
| `name` | string | Display name (Chinese) |
| `emoji` | string | Single emoji for UI display |
| `role` | `gm` \| `scene_host` | Only one NPC can have `role: gm` |
| `sceneId` | string \| null | Bound scene ID. `null` for the global GM. |
| `accent` | string | CSS color for UI theming |
| `scope` | string[] | Topic keywords (documentation only, not used for runtime gating) |
| `systemPrompt` | string | Full system prompt defining personality, role, scope boundaries |

### Prompt writing tips

1. Define personality clearly — name, role, tone
2. List what the NPC handles ("你的职责")
3. List what the NPC does NOT handle ("你不负责的事"), with redirect guidance
4. Never let the NPC promise things outside its scene's capabilities
5. The platform ontology is auto-injected into the NPC's system prompt — you don't need to describe scene topology in the prompt

### Checklist

- [ ] `specs/npcs/<key>.yaml` created with all required fields
- [ ] `key` matches what `platform-ontology.json` references
- [ ] `sceneId` matches the scene this NPC hosts
- [ ] NPC is registered in the DB with an owner (for AI-powered replies)

---

## 3. Adding a New Function Call (FC)

### Builtin FC (no code needed)

For navigation or display-only FCs, add to `operational-ontology.json`:

```jsonc
{
  "functionCalls": {
    "GM.showMarketplace": {
      "label": "展示应用市场",
      "scene": "marketplace",
      "category": "display",
      "behaviorPattern": "navigate",
      "requires": null,
      "produces": "展示市场数据",
      "npcHint": "访客在浏览应用市场",
      "execution": {
        "type": "builtin",
        "handler": "passthrough"
      }
    }
  }
}
```

**Builtin handlers:**

| handler | Behavior |
|:--------|:---------|
| `navigation` | Returns `{ status: 'executed' }`. Used for scene transitions. |
| `passthrough` | Returns `{ status: 'executed', detail: 'dataLoader 已加载' }`. Used for display-only actions where data is loaded via `dataLoader`. |

### SubFlow FC (no code needed — needs ComponentSpec YAML)

```jsonc
{
  "GM.startCheckout": {
    "label": "开始结算",
    "scene": "marketplace",
    "category": "subflow",
    "behaviorPattern": "subflow",
    "requires": "已选择应用",
    "produces": "进入 checkout 子流程",
    "npcHint": "结算流程已开始",
    "execution": {
      "type": "subflow",
      "specName": "checkout",
      "detail": "结算流程已开始"
    }
  }
}
```

This requires a matching `specs/checkout.yaml` ComponentSpec file.

### Business FC (needs code)

For FCs with custom logic (DB writes, external API calls):

1. Add the FC entry in `operational-ontology.json` with `execution.type: handler`:

```jsonc
{
  "GM.purchaseApp": {
    "label": "购买应用",
    "scene": "marketplace",
    "category": "business",
    "behaviorPattern": "select_one",
    "requires": "余额充足",
    "produces": "创建购买记录",
    "npcHint": "访客购买了应用",
    "sideEffects": ["写入 Purchase 记录", "扣减余额"],
    "execution": {
      "type": "handler",
      "handlerKey": "fc.purchaseApp"
    }
  }
}
```

2. Implement and register the handler in `src/lib/component-runtime/handler-registry.ts`:

```typescript
registerEffect('fc.purchaseApp', async (args, ctx) => {
  // Business logic here
  return { status: 'executed', detail: '购买成功' }
})
```

### FC entry fields

| Field | Required | Description |
|:------|:---------|:------------|
| `label` | Yes | Human-readable label for NPC context |
| `scene` | Yes | Scene ID or `null` for global FCs |
| `category` | Yes | `navigation` \| `display` \| `subflow` \| `business` |
| `behaviorPattern` | Yes | `navigate` \| `select_one` \| `subflow` \| `free_response` |
| `requires` | No | Free-text description of preconditions |
| `produces` | No | What the FC produces when executed |
| `failHint` | No | Explanation when FC fails |
| `npcHint` | No | What NPC should know after FC executes |
| `sideEffects` | No | Array of side effect descriptions |
| `execution` | Yes | Dispatch config (see above) |

---

## 4. Adding Preconditions

Preconditions gate action availability. They're defined inline in SceneSpec YAML:

```yaml
actions:
  - id: my_action
    # ...
    precondition:
      check: "session.data.hasBalance == true"
      failMessage:
        pa: "余额不足。"
        agent: "Insufficient balance."
```

### Expression syntax

```
path:    session.flags.<key> | session.data.<key>
op:      == | != | exists | !exists
value:   true | false | <string>
combo:   expr && expr | expr || expr | !expr
```

### Examples

| Expression | Meaning |
|:-----------|:--------|
| `session.flags.hasExperienced == true` | Player has experienced an app |
| `session.data.hasApps == true` | Apps are available in scene data |
| `session.data.isDeveloper != true` | Player is not a developer |
| `session.flags.purchased exists` | The `purchased` flag has been set |
| `session.data.hasApps == true && session.flags.hasExperienced != true` | Has apps but hasn't experienced yet |

### Registering a precondition in the ontology

For documentation and NPC awareness, also add the precondition to `operational-ontology.json`:

```jsonc
{
  "preconditions": {
    "hasBalance": {
      "meaning": "访客有足够余额",
      "source": "session.data",
      "unlocks": "购买应用"
    }
  }
}
```

---

## 5. Human Space: DomainSpec (CRUD APIs)

Agent Space uses YAML for scenes, NPCs, and SubFlows. **Human Space** uses **DomainSpec** for traditional REST-style domains: list, create, get, and custom actions — declared in `specs/domains/<name>.yaml` and executed by `src/lib/domain-runtime/`.

**Full reference**: [domain-spec-architecture.md](domain-spec-architecture.md)

### When to use DomainSpec

| Situation | Approach |
|:----------|:---------|
| Standard Prisma CRUD on one model | `operations.list` / `create` / `get` with `model: yourModel` (no extra code) |
| Multi-table aggregation, custom sorting | Set `operations.list.service` or `operations.get.service` and register handlers in `bootstrap.ts` |
| Nested routes or heavy validation | Hybrid: DomainSpec for main collection + hand-written route for sub-resources |

### Steps (minimal)

1. **Create** `specs/domains/<id>.yaml` — `id`, `model`, `operations` (see `specs/domains/practices.yaml` for pure Prisma; `specs/domains/pa-directory.yaml` for service delegation).
2. **Register** JSON schemas in `src/lib/domain-runtime/bootstrap.ts` if `create` uses `schema:`.
3. **Register** `registerListService` / `registerGetService` if the YAML references `service:` names.
4. **Wire routes** — thin files that call `ensureDomainBootstrap()` then `createDomainHandlers('<id>')` (see `src/app/api/practices/route.ts`).

### Checklist

- [ ] YAML matches parser rules (`list` has `orderBy` unless `service` is set on list)
- [ ] Bootstrap registers schemas and service handlers referenced by the spec
- [ ] Design doc [domain-spec-architecture.md](domain-spec-architecture.md) updated if behavior changes

---

## 6. Adding a SubFlow (ComponentSpec)

SubFlows are multi-step interactive processes. Create a ComponentSpec YAML in `specs/`:

```yaml
# specs/checkout.yaml
id: checkout
name: 结算流程
version: "1.0"

fields:
  - key: appId
    label: 应用 ID
    type: string
    required: true
    source: context    # auto-filled from context

  - key: paymentMethod
    label: 支付方式
    type: string
    required: true
    options:
      - value: balance
        label: 余额支付
      - value: points
        label: 积分兑换

  - key: confirm
    label: 确认购买
    type: confirm
    required: true

effects:
  - key: createPurchase
    handler: effect.createPurchase
    trigger: onConfirm
```

Then register the matching FC in `operational-ontology.json` (see section 3, SubFlow FC).

---

## 7. File Reference

### Spec files (you write these)

| Path | What it defines |
|:-----|:---------------|
| `specs/scenes/<id>.yaml` | Scene: theme, opening, actions, fallback, dataLoader |
| `specs/npcs/<key>.yaml` | NPC: personality, role, scope, system prompt |
| `specs/<name>.yaml` | ComponentSpec: SubFlow fields, effects, steps |
| `specs/behaviors/<id>.yaml` | BehaviorSpec: agent behavior declaration |
| `specs/domains/<id>.yaml` | DomainSpec: Human Space CRUD + service delegation |

### Ontology files (you extend these)

| Path | What it defines |
|:-----|:---------------|
| `src/lib/engine/platform-ontology.json` | World model: scenes, NPCs, capabilities, exits, topology |
| `src/lib/engine/operational-ontology.json` | FC registry + execution dispatch, data loaders, preconditions |

### Config files (you extend these)

| Path | What it defines |
|:-----|:---------------|
| `src/lib/scene-visuals/configs.json` | Visual config per scene (accent, icon, NPC skin, animations) |

### Schema files (for validation)

| Path | Validates |
|:-----|:---------|
| `specs/scenespec.schema.json` | SceneSpec YAML structure |
| `specs/componentspec.schema.json` | ComponentSpec YAML structure |

---

## 8. Common Pitfalls

1. **Forgetting `back_lobby`** — Every non-lobby scene needs a `back_lobby` action with `outcome: move` and `transition: { type: enter_space, target: lobby }`.

2. **Forgetting to update `platform-ontology.json`** — Without it, NPCs won't know the new scene exists and will give wrong navigation advice.

3. **Plain strings instead of DualText** — All text must be `{ pa: "...", agent: "..." }`. Never use a bare string.

4. **Missing `actIntent`** — The AI classifier needs `actIntent` to match user messages to actions. Without it, the action is unreachable via natural language.

5. **Missing `execution` on new FCs** — `fc-dispatcher.ts` will silently skip FCs without an `execution` field. Always add it.

6. **Changing NPC `key` after deployment** — This breaks session history and DB references. Choose the key carefully upfront.

7. **Forgetting visual config** — The frontend uses `configs.json` for scene transitions and NPC rendering. Missing config causes rendering issues.
