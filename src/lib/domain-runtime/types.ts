/**
 * DomainSpec Runtime — Core Types
 *
 * Architecture: docs/domain-spec-architecture.md
 *
 * DomainSpec declares Human Space CRUD domains in YAML. The runtime
 * maps spec declarations to Prisma queries and Next.js response helpers.
 */

// ─── Spec Types (mirror YAML structure) ──────────

export type AuthPolicy = 'public' | 'authenticated' | 'developer'

export type FilterType = 'exact' | 'enum' | 'array_contains' | 'search'

export interface FilterDef {
  type: FilterType
  values?: string[]
  fields?: string[]
}

export interface VisibilityRule {
  default?: Record<string, unknown>
  ownerOverride?: {
    field: string
    match: string
  }
}

export interface IncludeRelation {
  select: Record<string, boolean>
}

export interface SideEffectDef {
  type: 'increment' | 'decrement'
  field: string
  amount?: number
}

export interface ListOperation {
  auth: AuthPolicy
  pagination: { pageSize: number }
  filters?: Record<string, FilterDef>
  visibility?: VisibilityRule
  /** Required for Prisma-backed list; omit when `service` is set. */
  orderBy?: Record<string, 'asc' | 'desc'>
  /**
   * Registered list HTTP handler name (see `registerListService` in bootstrap).
   * When set, runtime skips Prisma `findMany` and delegates to the service
   * (e.g. multi-model aggregation in `src/lib/pa-directory`).
   */
  service?: string
}

export interface CreateOperation {
  auth: AuthPolicy
  schema: string
  defaults?: Record<string, string>
}

export interface GetOperation {
  auth: AuthPolicy
  visibility?: { filter: Record<string, unknown> }
  sideEffects?: SideEffectDef[]
  /**
   * Registered get HTTP handler name (see `registerGetService` in bootstrap).
   * When set, runtime skips Prisma `findUnique` and delegates to the service.
   */
  service?: string
  /**
   * Dynamic route segment / Prisma unique field (default `id`).
   * Example: `agentId` for `/api/pa-directory/[agentId]` → `where: { agentId }`.
   */
  paramKey?: string
}

export interface ActionOperation {
  type: 'action'
  auth: AuthPolicy
  visibility?: { filter: Record<string, unknown> }
  effect: SideEffectDef
  response: { fields: string[] }
}

export interface DomainOperations {
  list?: ListOperation
  create?: CreateOperation
  get?: GetOperation
  [key: string]: ListOperation | CreateOperation | GetOperation | ActionOperation | undefined
}

export interface DomainSpec {
  id: string
  model: string
  description?: string
  include?: Record<string, IncludeRelation>
  operations: DomainOperations
}

// ─── Runtime Types ───────────────────────────────

export interface DomainHandlerContext {
  userId?: string
  isDeveloper?: boolean
}
