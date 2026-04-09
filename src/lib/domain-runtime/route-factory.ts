/**
 * DomainSpec Runtime — Route Factory
 *
 * Generates typed Next.js route handlers from a DomainSpec.
 * Routes become ultra-thin: 2-3 lines that delegate to spec-driven handlers.
 *
 * Architecture: docs/domain-spec-architecture.md §4
 */

import { NextRequest } from 'next/server'
import {
  apiSuccess,
  apiPaginated,
  apiError,
  requireAuth,
  requireDeveloper,
  AuthError,
  ForbiddenError,
} from '@/lib/api-utils'
import { getCurrentUser } from '@/lib/auth'
import { parseJsonBody } from '@/lib/validators/parse-json-body'
import { rootLogger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { loadDomainSpec } from './parser'
import type {
  DomainSpec,
  AuthPolicy,
  ListOperation,
  CreateOperation,
  GetOperation,
  ActionOperation,
  FilterDef,
  VisibilityRule,
} from './types'

/** Dynamic route params (`id`, `agentId`, …). */
export type RouteContext = { params: Promise<Record<string, string>> }

// ─── Service Registry (DomainSpec `service:` delegation) ─────────────

const listServiceRegistry = new Map<string, (request: NextRequest) => Promise<Response>>()
const getServiceRegistry = new Map<
  string,
  (request: NextRequest, ctx: RouteContext) => Promise<Response>
>()

/** Register a list handler referenced by DomainSpec `operations.list.service`. */
export function registerListService(
  name: string,
  handler: (request: NextRequest) => Promise<Response>,
): void {
  listServiceRegistry.set(name, handler)
}

/** Register a get handler referenced by DomainSpec `operations.get.service`. */
export function registerGetService(
  name: string,
  handler: (request: NextRequest, ctx: RouteContext) => Promise<Response>,
): void {
  getServiceRegistry.set(name, handler)
}

// ─── Schema Registry ─────────────────────────────
// Schemas are registered here so the spec can reference them by name.

const schemaRegistry = new Map<string, object>()

export function registerSchema(name: string, schema: object): void {
  schemaRegistry.set(name, schema)
}

// ─── Prisma Model Delegate ───────────────────────

type PrismaDelegate = {
  findMany: (args: Record<string, unknown>) => Promise<unknown[]>
  count: (args: Record<string, unknown>) => Promise<number>
  create: (args: Record<string, unknown>) => Promise<unknown>
  findUnique: (args: Record<string, unknown>) => Promise<unknown>
  update: (args: Record<string, unknown>) => Promise<unknown>
}

function getPrismaDelegate(modelName: string): PrismaDelegate {
  const delegate = (prisma as unknown as Record<string, unknown>)[modelName]
  if (!delegate) {
    throw new Error(`Prisma model '${modelName}' not found. Check DomainSpec 'model' field.`)
  }
  return delegate as unknown as PrismaDelegate
}

// ─── Auth Enforcement ────────────────────────────

async function enforceAuth(policy: AuthPolicy): Promise<{ id: string; isDeveloper: boolean } | null> {
  switch (policy) {
    case 'public': {
      const user = await getCurrentUser()
      return user ? { id: user.id, isDeveloper: user.isDeveloper } : null
    }
    case 'authenticated': {
      const user = await requireAuth()
      return { id: user.id, isDeveloper: user.isDeveloper }
    }
    case 'developer': {
      const user = await requireAuth()
      requireDeveloper(user)
      return { id: user.id, isDeveloper: true }
    }
  }
}

// ─── Filter Builder ──────────────────────────────

function buildWhereFromFilters(
  searchParams: URLSearchParams,
  filters: Record<string, FilterDef> | undefined,
): Record<string, unknown> {
  const where: Record<string, unknown> = {}
  if (!filters) return where

  for (const [paramName, filterDef] of Object.entries(filters)) {
    const value = searchParams.get(paramName)
    if (!value) continue

    switch (filterDef.type) {
      case 'exact':
        where[paramName] = value
        break
      case 'enum':
        if (filterDef.values?.includes(value)) {
          where[paramName] = value
        }
        break
      case 'array_contains':
        where[paramName] = { array_contains: value }
        break
      case 'search':
        if (filterDef.fields) {
          where.OR = filterDef.fields.map(f => ({
            [f]: { contains: value, mode: 'insensitive' },
          }))
        }
        break
    }
  }

  return where
}

function applyVisibility(
  where: Record<string, unknown>,
  visibility: VisibilityRule | undefined,
  userId: string | undefined,
  searchParams: URLSearchParams,
): void {
  if (!visibility) return

  if (visibility.ownerOverride && userId) {
    const ownerField = visibility.ownerOverride.field
    const paramValue = searchParams.get(ownerField)

    if (paramValue === userId) {
      return
    }
  }

  if (visibility.default) {
    Object.assign(where, visibility.default)
  }
}

// ─── Include Builder ─────────────────────────────

function buildInclude(spec: DomainSpec): Record<string, unknown> | undefined {
  if (!spec.include) return undefined
  const include: Record<string, unknown> = {}
  for (const [rel, config] of Object.entries(spec.include)) {
    include[rel] = { select: config.select }
  }
  return include
}

// ─── Handler Generators ──────────────────────────

function createListHandler(spec: DomainSpec, op: ListOperation) {
  if (op.service) {
    const svc = listServiceRegistry.get(op.service)
    if (!svc) {
      throw new Error(
        `DomainSpec '${spec.id}': unknown list service '${op.service}'. Register it in bootstrap via registerListService().`,
      )
    }
    return async (request: NextRequest) => {
      try {
        await enforceAuth(op.auth)
        return svc(request)
      } catch (error) {
        if (error instanceof AuthError) return error.response
        if (error instanceof ForbiddenError) return error.response
        rootLogger.error({ err: error }, `DomainSpec ${spec.id} list (service) failed`)
        return apiError('查询失败', 500)
      }
    }
  }

  if (!op.orderBy) {
    throw new Error(
      `DomainSpec '${spec.id}': list.operation requires orderBy when not using service delegation`,
    )
  }

  const delegate = getPrismaDelegate(spec.model)
  const include = buildInclude(spec)

  return async (request: NextRequest) => {
    try {
      const user = await enforceAuth(op.auth)
      const { searchParams } = new URL(request.url)
      const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
      const pageSize = op.pagination.pageSize

      const where = buildWhereFromFilters(searchParams, op.filters)
      applyVisibility(where, op.visibility, user?.id, searchParams)

      const queryArgs: Record<string, unknown> = {
        where,
        orderBy: op.orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }
      if (include) queryArgs.include = include

      const [items, total] = await Promise.all([
        delegate.findMany(queryArgs),
        delegate.count({ where }),
      ])

      return apiPaginated(items as unknown[], total, page, pageSize)
    } catch (error) {
      if (error instanceof AuthError) return error.response
      if (error instanceof ForbiddenError) return error.response
      rootLogger.error({ err: error }, `DomainSpec ${spec.id} list failed`)
      return apiError('查询失败', 500)
    }
  }
}

function createCreateHandler(spec: DomainSpec, op: CreateOperation) {
  const delegate = getPrismaDelegate(spec.model)
  const include = buildInclude(spec)

  return async (request: NextRequest) => {
    try {
      const user = await enforceAuth(op.auth)

      let body: unknown
      try {
        body = await request.json()
      } catch {
        return apiError('请求体不是有效的 JSON', 400)
      }

      const schema = schemaRegistry.get(op.schema)
      if (schema) {
        const parsed = parseJsonBody<Record<string, unknown>>(body, schema)
        if (!parsed.ok) return apiError(parsed.message, 400)
        body = parsed.data
      }

      const data = { ...(body as Record<string, unknown>) }
      if (op.defaults) {
        for (const [field, template] of Object.entries(op.defaults)) {
          if (template === '{userId}' && user) {
            data[field] = user.id
          } else if (!template.startsWith('{')) {
            data[field] = template
          }
        }
      }

      const createArgs: Record<string, unknown> = { data }
      if (include) createArgs.include = include

      const result = await delegate.create(createArgs)
      return apiSuccess(result)
    } catch (error) {
      if (error instanceof AuthError) return error.response
      if (error instanceof ForbiddenError) return error.response
      rootLogger.error({ err: error }, `DomainSpec ${spec.id} create failed`)
      return apiError('创建失败', 500)
    }
  }
}

function createGetHandler(spec: DomainSpec, op: GetOperation) {
  if (op.service) {
    const svc = getServiceRegistry.get(op.service)
    if (!svc) {
      throw new Error(
        `DomainSpec '${spec.id}': unknown get service '${op.service}'. Register it in bootstrap via registerGetService().`,
      )
    }
    return async (request: NextRequest, ctx: RouteContext) => {
      try {
        await enforceAuth(op.auth)
        return svc(request, ctx)
      } catch (error) {
        if (error instanceof AuthError) return error.response
        if (error instanceof ForbiddenError) return error.response
        rootLogger.error({ err: error }, `DomainSpec ${spec.id} get (service) failed`)
        return apiError('查询失败', 500)
      }
    }
  }

  const delegate = getPrismaDelegate(spec.model)
  const include = buildInclude(spec)

  return async (_request: NextRequest, ctx: RouteContext) => {
    try {
      await enforceAuth(op.auth)
      const paramKey = op.paramKey ?? 'id'
      const params = await ctx.params
      const idValue = params[paramKey]
      if (!idValue) return apiError('未找到', 404)

      const findArgs: Record<string, unknown> = { where: { [paramKey]: idValue } }
      if (include) findArgs.include = include

      const item = await delegate.findUnique(findArgs) as Record<string, unknown> | null
      if (!item) return apiError('未找到', 404)

      if (op.visibility?.filter) {
        for (const [field, value] of Object.entries(op.visibility.filter)) {
          if (item[field] !== value) return apiError('未找到', 404)
        }
      }

      if (op.sideEffects?.length) {
        const updateData: Record<string, unknown> = {}
        for (const effect of op.sideEffects) {
          if (effect.type === 'increment') {
            updateData[effect.field] = { increment: effect.amount ?? 1 }
          } else if (effect.type === 'decrement') {
            updateData[effect.field] = { decrement: effect.amount ?? 1 }
          }
        }
        await delegate.update({ where: { [paramKey]: idValue }, data: updateData })

        for (const effect of op.sideEffects) {
          const current = item[effect.field]
          if (typeof current === 'number') {
            const delta = effect.type === 'increment' ? (effect.amount ?? 1) : -(effect.amount ?? 1)
            item[effect.field] = current + delta
          }
        }
      }

      return apiSuccess(item)
    } catch (error) {
      if (error instanceof AuthError) return error.response
      if (error instanceof ForbiddenError) return error.response
      rootLogger.error({ err: error }, `DomainSpec ${spec.id} get failed`)
      return apiError('查询失败', 500)
    }
  }
}

function createActionHandler(spec: DomainSpec, op: ActionOperation) {
  const delegate = getPrismaDelegate(spec.model)

  return async (_request: NextRequest, ctx: RouteContext) => {
    try {
      await enforceAuth(op.auth)
      const { id } = await ctx.params

      const item = await delegate.findUnique({
        where: { id },
        select: { id: true, ...(op.visibility?.filter ? Object.fromEntries(
          Object.keys(op.visibility.filter).map(k => [k, true]),
        ) : {}) },
      }) as Record<string, unknown> | null

      if (!item) return apiError('未找到', 404)

      if (op.visibility?.filter) {
        for (const [field, value] of Object.entries(op.visibility.filter)) {
          if (item[field] !== value) return apiError('未找到', 404)
        }
      }

      const updateData: Record<string, unknown> = {}
      if (op.effect.type === 'increment') {
        updateData[op.effect.field] = { increment: op.effect.amount ?? 1 }
      } else if (op.effect.type === 'decrement') {
        updateData[op.effect.field] = { decrement: op.effect.amount ?? 1 }
      }

      const selectFields = Object.fromEntries(op.response.fields.map(f => [f, true]))
      const updated = await delegate.update({
        where: { id },
        data: updateData,
        select: selectFields,
      }) as Record<string, unknown>

      return apiSuccess(updated)
    } catch (error) {
      if (error instanceof AuthError) return error.response
      if (error instanceof ForbiddenError) return error.response
      rootLogger.error({ err: error }, `DomainSpec ${spec.id} action failed`)
      return apiError('操作失败', 500)
    }
  }
}

// ─── Public API ──────────────────────────────────

export interface DomainHandlers {
  list: (request: NextRequest) => Promise<Response>
  create: (request: NextRequest) => Promise<Response>
  get: (request: NextRequest, ctx: RouteContext) => Promise<Response>
  action: (actionName: string, request: NextRequest, ctx: RouteContext) => Promise<Response>
}

export function createDomainHandlers(specId: string): DomainHandlers {
  const spec = loadDomainSpec(specId)
  const ops = spec.operations

  const actionHandlers = new Map<string, (request: NextRequest, ctx: RouteContext) => Promise<Response>>()
  for (const [name, opDef] of Object.entries(ops)) {
    if (name === 'list' || name === 'create' || name === 'get') continue
    if (opDef && typeof opDef === 'object' && 'type' in opDef && opDef.type === 'action') {
      actionHandlers.set(name, createActionHandler(spec, opDef as ActionOperation))
    }
  }

  return {
    list: ops.list
      ? createListHandler(spec, ops.list)
      : async () => apiError('List operation not defined', 404),

    create: ops.create
      ? createCreateHandler(spec, ops.create)
      : async () => apiError('Create operation not defined', 404),

    get: ops.get
      ? createGetHandler(spec, ops.get)
      : async () => apiError('Get operation not defined', 404),

    action: async (actionName: string, request: NextRequest, ctx: RouteContext) => {
      const handler = actionHandlers.get(actionName)
      if (!handler) return apiError(`Action '${actionName}' not defined`, 404)
      return handler(request, ctx)
    },
  }
}
