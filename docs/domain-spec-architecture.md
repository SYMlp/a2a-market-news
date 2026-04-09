# DomainSpec Architecture — Human Space Declarative CRUD

> **Level**: D2 (module doc)
> **Date**: 2026-03-22
> **Status**: PoC (Practices domain implemented)
> **Depends on**: `human-space-domain-map.md`, `component-spec-architecture.md` (parallel pattern)

## §1 Core Insight

Agent Space uses BehaviorSpec (YAML → runtime) to declare agent capabilities. Human Space should use a similar declarative approach for CRUD domains: a DomainSpec declares what a domain does (model, operations, auth, filters, side effects), and a shared runtime generates the handlers.

```text
BehaviorSpec (Agent Space):          DomainSpec (Human Space):

  "What can the agent do?"            "What can the domain CRUD?"
  ├── browse_apps                     ├── practices
  ├── register_app                    ├── pa-directory  (service delegation PoC)
  └── edit_profile                    └── community     (future)
      ↑                                   ↑
      classifies by capability            classifies by domain
```

### §1.1 Why This Matters

Before DomainSpec, each domain's API routes contained ~40-70 lines of boilerplate: auth checks, query param parsing, where-clause building, pagination, error handling. The actual domain-specific logic (which model, which filters, which side effects) was buried in this boilerplate.

DomainSpec extracts the domain-specific declarations into YAML and generates the boilerplate. Adding a new CRUD domain = 1 YAML file + 2-line route files.

### §1.2 Relationship to BehaviorSpec

| Aspect | BehaviorSpec | DomainSpec |
|:-------|:-------------|:-----------|
| Space | Agent Space | Human Space |
| Organizing axis | Agent capability | Domain CRUD |
| Spec location | `specs/behaviors/*.yaml` | `specs/domains/*.yaml` |
| Runtime | `src/lib/behavior-engine/` | `src/lib/domain-runtime/` |
| Schema | `specs/behaviorspec.schema.json` | (future) |
| Consumes | Session, ontology, prompts | Prisma, auth, validators |

Both follow the same meta-pattern: YAML spec → parser → runtime → thin route/handler.

## §2 DomainSpec Format

### §2.1 Top-Level Structure

```yaml
id: practices                    # unique identifier (matches YAML filename)
model: developerPractice         # Prisma model name (camelCase)
description: "开发者实践分享"

include:                         # Prisma relations to include in queries
  author:
    select: { id: true, name: true, avatarUrl: true }

operations:                      # CRUD + custom actions
  list: { ... }
  create: { ... }
  get: { ... }
  like: { ... }                  # custom action
```

### §2.2 Operations

#### `list` — Paginated Collection

```yaml
list:
  auth: public                   # public | authenticated | developer
  pagination:
    pageSize: 12
  filters:
    category:
      type: enum                 # exact | enum | array_contains | search
      values: [practice, showcase, tip]
    tags:
      type: array_contains
    authorId:
      type: exact
  visibility:
    default:                     # applied unless ownerOverride matches
      status: published
    ownerOverride:               # skip default visibility when viewer is owner
      field: authorId
      match: viewerUserId
  orderBy:
    createdAt: desc
```

| Filter type | Prisma where clause |
|:------------|:--------------------|
| `exact` | `{ field: value }` |
| `enum` | `{ field: value }` (validated against `values[]`) |
| `array_contains` | `{ field: { array_contains: value } }` |
| `search` | `{ OR: fields.map(f => { [f]: { contains: value } }) }` |

#### `create` — Single Record

```yaml
create:
  auth: developer
  schema: practicePostSchema     # references registered JSON Schema
  defaults:
    authorId: "{userId}"         # {userId} interpolated from auth context
    status: published            # literal default
```

#### `get` — Single Record by ID

```yaml
get:
  auth: public
  visibility:
    filter:
      status: published          # hard filter: only published records are visible
  sideEffects:
    - type: increment
      field: viewCount
```

Optional fields:

| Field | Meaning |
|:------|:--------|
| `service` | Registered get handler name; skips Prisma when set (see §3.3). |
| `paramKey` | Dynamic segment / Prisma field (default `id`). Example: `agentId` for `/api/pa-directory/[agentId]`. |

#### `list` — Service delegation (non-Prisma)

When `list.service` is set, `orderBy` is omitted and the registered list handler is responsible for parsing query params and returning `apiPaginated` / `apiListPage` responses.

```yaml
list:
  auth: public
  pagination:
    pageSize: 50
  service: paDirectoryList
```

#### Custom Actions (e.g. `like`)

```yaml
like:
  type: action
  auth: authenticated
  visibility:
    filter:
      status: published
  effect:
    type: increment              # increment | decrement
    field: likeCount
  response:
    fields: [likeCount]          # which fields to return after mutation
```

## §3 Runtime Architecture

### §3.1 Directory Structure

```text
specs/domains/
  practices.yaml
  pa-directory.yaml

src/lib/domain-runtime/
  types.ts                 — TypeScript types mirroring YAML format
  parser.ts                — YAML loader + structural validator
  route-factory.ts         — spec → Next.js handler generators + service registry
  pa-directory-handlers.ts — HTTP adapters for PA Directory (service delegation)
  bootstrap.ts             — schema + list/get service registration on startup
  index.ts                 — public API re-exports
```

### §3.2 Data Flow

```text
specs/domains/practices.yaml
  ↓
parser.loadDomainSpec('practices')
  ↓ validates structure, caches
DomainSpec object
  ↓
route-factory.createDomainHandlers('practices')
  ↓ generates: list, create, get, action handlers
DomainHandlers { list, create, get, action }
  ↓
API route files delegate to handlers (2-3 lines each)
```

### §3.3 Schema and Service Registration

Validation schemas are registered at bootstrap time so specs can reference them by name:

```typescript
// bootstrap.ts
import { registerSchema } from './route-factory'
import { practicePostSchema } from '@/lib/validators/schemas/practice-post'

registerSchema('practicePostSchema', practicePostSchema)
```

**Service delegation** — When `operations.list.service` or `operations.get.service` is set in YAML, the runtime calls a handler registered via `registerListService` / `registerGetService` (see `bootstrap.ts` and `pa-directory-handlers.ts`). Use this for multi-model aggregation or any logic that cannot be expressed as a single Prisma `findMany` / `findUnique`.

This keeps specs declarative (no code imports in YAML) while reusing existing validators and domain libs.

### §3.4 Auth Enforcement

| Policy | Behavior |
|:-------|:---------|
| `public` | No auth required; user context available if logged in |
| `authenticated` | Must be logged in (throws 401) |
| `developer` | Must be logged in AND have `isDeveloper: true` (throws 403) |

`public` still invokes `getCurrentUser()` (via `enforceAuth`), which uses Next.js `cookies()`. **Vitest** route tests that hit generated handlers should `vi.mock('next/headers')` (see `src/app/api/pa-directory/*.test.ts`) or mock `createDomainHandlers` like `practices/route.test.ts`.

### §3.5 Visibility Rules

Two patterns supported:

1. **Default filter** — applied to all queries unless overridden
2. **Owner override** — when the requesting user matches the owner field, skip the default filter (e.g., authors can see their own drafts)

## §4 Route Integration

### §4.1 Collection Route (`/api/{domain}`)

```typescript
import { createDomainHandlers } from '@/lib/domain-runtime'
import { ensureDomainBootstrap } from '@/lib/domain-runtime/bootstrap'

ensureDomainBootstrap()
const handlers = createDomainHandlers('practices')

export async function GET(request: NextRequest) {
  return handlers.list(request)
}

export async function POST(request: NextRequest) {
  return handlers.create(request)
}
```

### §4.2 Item Route (`/api/{domain}/[id]`)

```typescript
ensureDomainBootstrap()
const handlers = createDomainHandlers('practices')

export async function GET(request, ctx) {
  return handlers.get(request, ctx)
}

export async function POST(request, ctx) {
  return handlers.action('like', request, ctx)
}
```

## §5 Adding a New Domain

1. Create `specs/domains/<name>.yaml` following the format in §2
2. Register any validation schemas in `bootstrap.ts`
3. Create route files that delegate to `createDomainHandlers('<name>')`
4. Update `human-space-domain-map.md` to reference the DomainSpec

No service files, no handler files, no per-domain boilerplate.

## §6 Escape Hatches

For domains with complex business logic that DomainSpec can't express:

1. **`operations.*.service`**: Register list/get HTTP adapters in `bootstrap.ts` (see §3.3, §7.1).
2. **Hybrid approach**: Use DomainSpec for list/detail, hand-write nested routes (e.g. `/questions`).
3. **Domain service fallback**: If >50% of operations need custom logic, skip DomainSpec and use the traditional service pattern

DomainSpec targets the 80% of domains that are standard CRUD. It's a tool, not a mandate.

## §7 PoC: Practices Domain

The Practices domain was the first implementation:

| Metric | Before (hand-written) | After (DomainSpec) |
|:-------|:---------------------|:-------------------|
| Route code | 77 lines across 2 files | 24 lines across 2 files |
| Service code | 153 lines in `practices/index.ts` | 0 (runtime-generated) |
| Spec declaration | — | 55 lines YAML |
| Total | ~230 lines of domain-specific code | ~79 lines (66% reduction) |

The service layer (`src/lib/practices/index.ts`) is retained for backward compatibility — other code may import it directly. Future domains can skip the service layer entirely.

## §7.1 PoC: PA Directory (service delegation)

PA Directory list/detail aggregate multiple models (badges, achievements, feedbacks, hall of fame). Those operations are not plain Prisma list/get.

| Piece | Role |
|:------|:-----|
| `specs/domains/pa-directory.yaml` | Declares `list.service: paDirectoryList`, `get.service: paDirectoryGet`, `paramKey: agentId` |
| `src/lib/domain-runtime/pa-directory-handlers.ts` | HTTP adapters calling `listPADirectory` / `getPADetail` from `src/lib/pa-directory/index.ts` |
| `src/lib/domain-runtime/bootstrap.ts` | `registerListService` / `registerGetService` |
| `/api/pa-directory/[agentId]/questions` | Remains hand-written (nested resource + body validation) |

This validates the **service** escape hatch: YAML still documents auth and pagination defaults; runtime behavior lives in one registered adapter per operation.

## §8 Future Work

- JSON Schema validation for DomainSpec YAML (parallel to `behaviorspec.schema.json`)
- `update` operation type (PUT/PATCH with field-level permissions)
- `delete` operation type (with soft-delete support)
- Cross-domain side effects (e.g., creating a practice triggers gamification)
- DomainSpec-driven frontend form generation (parallel to SpecFormCard)
