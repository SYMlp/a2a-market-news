# ComponentSpec Architecture

> **Level**: D2 (module doc)
> **Date**: 2026-03
> **Depends on**: `pa-lifecycle-architecture.md`, `game-loop-architecture.md`

## §1 Overview

ComponentSpec replaces hand-written SubFlow handlers and card components with **declarative YAML specs** plus a shared runtime. Each SubFlow (app-settings, profile, app-lifecycle, register) is defined in a single YAML file. The runtime generates `SubFlowHandler` and `SpecFormCard` renders the confirmation UI.

**Net effect**: ~1,425 lines of per-SubFlow code → ~250 lines of YAML + ~650 lines of shared runtime. Each future SubFlow = 1 new YAML file, zero handler/card code.

---

## §2 ComponentSpec Format

### 2.1 File Layout

Specs live in `specs/`:

- `app-settings.yaml`
- `profile.yaml`
- `app-lifecycle.yaml`
- `register.yaml`

Validated against `specs/componentspec.schema.json` (JSON Schema meta-schema).

### 2.2 Top-Level Structure

| Key | Required | Description |
|:---|:---|:---|
| `id` | ✓ | SubFlow type: `app_settings`, `profile`, `app_lifecycle`, `register` |
| `functionCall` | ✓ | GM function for confirm phase (e.g. `GM.updateAppSettings`) |
| `lifecycle` | ✓ | Steps, initial step, `onKeyword`, `delays`, `onSceneChange`, optional `validationGate` |
| `actions` | ✓ | `confirm` action: params, effect, ownership check, onSuccess/onError |
| `dataSource` | — | For app-oriented collect (app list source) |
| `collect` | — | Collect phase config (preconditions, transitions, extract) |
| `state` | — | `display` (header, confirmLabel, hint) and `fields` for SpecFormCard |
| `visibility` | — | `agent.export: true` → expose as MCP tool |

### 2.3 Lifecycle

```
collect → [validationGate] → confirm → done
```

- **collect**: Gather inputs from conversation (app selection, profile fields, app info)
- **validationGate** (optional): External check before confirm (e.g. `validate.secondme-app`)
- **confirm**: User confirms via card → effect runs

Lifecycle extensions:

- `onKeyword.patterns` — cancel keywords (e.g. "取消", "算了", "cancel")
- `delays.confirmTimeout` — auto-cancel after N ms
- `onSceneChange: cancel` — clear SubFlow on scene change

### 2.4 Collect Strategies

| Strategy | Spec shape | Used by |
|:---|:---|:---|
| App-oriented | `dataSource` + `collect.singleAppAutoSelect`, `transitionToConfirm` | app-settings, app-lifecycle |
| Regex-driven | `collect.extractFromMessage.patterns` | profile |
| Effect-driven | `collect.extract` + `transitions` | register |

### 2.5 Effect References (ADR-5)

Specs reference effects by string key. The runtime looks them up in `handler-registry.ts`:

| Effect | Handler | SubFlow |
|:---|:---|:---|
| `db.app.update` | Prisma app update (name, desc, website, status) | app-settings, app-lifecycle |
| `db.user.update` | Prisma user update (developerName, callback, notifyPref) | profile |
| `validate.secondme-app` | SecondMe API validation | register |
| `extract.app-info` | LLM extraction of app info from messages | register |
| `extract.client-id` | Regex extraction of clientId | register |

---

## §3 Runtime Architecture

### 3.1 Directory Structure

```
specs/
  app-settings.yaml
  profile.yaml
  app-lifecycle.yaml
  register.yaml
  componentspec.schema.json
src/lib/component-runtime/
  types.ts         — TypeScript types mirroring YAML
  parser.ts        — YAML loader + schema validator
  handler-registry.ts — effect key → implementation
  subflow-adapter.ts  — spec → SubFlowHandler
  lifecycle-manager.ts — cancel patterns, timeout, XState machine
  mcp-export.ts    — visibility.agent.export → MCP tool descriptors
```

### 3.2 Data Flow

```
YAML spec → parser.loadSpec() → validateSpec() → ComponentSpec
                                          ↓
                        createSubFlowHandler(spec)
                                          ↓
              SubFlowHandler { handleMessage, handleConfirm }
                                          ↓
                    router.ts: handlers.get(type) → handleMessage / handleConfirm
```

### 3.3 Handler Registry

`handler-registry.ts` implements the **string-referenced effect pattern**:

- Spec declares `effect: db.app.update`
- Adapter calls `invokeEffect('db.app.update', args, context)`
- Registry maps key → async handler; throws `EffectError` for HTTP status propagation

New effects: register handler in `registerEffect(key, fn)` and ensure spec references the key.

### 3.4 SubFlow Adapter

`subflow-adapter.ts` maps spec structure to `SubFlowHandler`:

- **handleMessage**: Routes by `subFlow.step` and `spec.collect` / `spec.awaitingClientId` / `spec.validationGate`
- **handleConfirm**: Validates params, checks ownership, invokes `actions.confirm.effect`, interpolates onSuccess/onError messages

Three collect strategies are implemented as branches; the adapter selects by spec shape (dataSource vs extract vs transitions).

---

## §4 Rendering Pipeline

### 4.1 SpecFormCard

`SpecFormCard.tsx` renders the confirmation UI from spec metadata:

- **Header**: `spec.state.display.header`
- **Fields**: `spec.state.fields` (key, label, type, placeholder, x-ui)
- **Confirm label**: `spec.state.display.confirmLabel`
- **Params**: `spec.actions.confirm.params` (passed to form for validation/submit)

No per-SubFlow card components; all four SubFlows use a single generic card.

### 4.2 Wire-in

`lobby/page.tsx` replaces the `subFlowCard.type` switch with:

```tsx
<SpecFormCard spec={loadedSpec} card={subFlowCard} onConfirm={...} onCancel={...} />
```

---

## §5 Lifecycle Manager

`lifecycle-manager.ts` provides:

- `getCancelPatterns(spec)` — from `spec.lifecycle.onKeyword.patterns` or defaults
- `getConfirmTimeoutMs(spec)` — from `spec.lifecycle.delays.confirmTimeout`
- `isConfirmTimeoutExceeded(spec, activatedAt)` — auto-cancel check
- `createLifecycleMachine(spec)` — XState machine from `spec.lifecycle` (for future use)

Router uses patterns and timeout; scene-change cleanup is handled by `clearSceneScopedFlags` on enter/transition.

---

## §6 MCP Export

`mcp-export.ts` generates MCP tool descriptors for specs with `visibility.agent.export: true`:

- `specToMcpTool(spec)` — single spec → `{ name, description, inputSchema }`
- `getComponentSpecMcpTools()` — all exportable specs → tool list

`inputSchema` is derived from `spec.actions.confirm.params` (JSON Schema format).

Wired into `/api/mcp` route: `tools/list` merges built-in tools with ComponentSpec-derived tools. `tools/call` for `gm_*` tools delegates to `chat_with_gm`.

---

## §7 Adding a New SubFlow

1. Create `specs/<name>.yaml` following existing specs
2. Add spec name to `parser.ts` `loadAllSpecs()` if using MCP export
3. Add `SubFlowType` and `SPEC_NAME_BY_TYPE` entry in `router.ts`
4. Create `createSubFlowHandler(loadSpec('<name>'))` and register in `handlers` Map
5. Add FC dispatch in `process/route.ts` (or use generic `activateFromSpec` if refactored)
6. No new handler file or card component required
