/**
 * DomainSpec HTTP adapters for PA Directory — multi-model aggregation.
 *
 * Registered in bootstrap as `paDirectoryList` / `paDirectoryGet`.
 * Spec: specs/domains/pa-directory.yaml
 *
 * Uses dynamic import() for `@/lib/pa-directory` so Vitest `vi.mock('@/lib/pa-directory')`
 * applies at call time (tests); static imports would bind before mocks.
 */

import { NextRequest } from 'next/server'
import { apiError, apiListPage, apiSuccess, parsePaginationParams } from '@/lib/api-utils'
import type { RouteContext } from './route-factory'

export async function paDirectoryList(request: NextRequest): Promise<Response> {
  const { listPADirectory } = await import('@/lib/pa-directory')
  const { searchParams } = new URL(request.url)
  const { page, limit } = parsePaginationParams(searchParams, {
    defaultLimit: 50,
    maxLimit: 100,
  })
  const search = searchParams.get('search')?.trim() ?? null
  const sort = searchParams.get('sort') ?? 'lastActive'

  const result = await listPADirectory({ page, limit, search, sort })
  if (!result.ok) {
    return apiError(result.error, result.status)
  }

  return apiListPage(result.data.visitors, result.data.pagination)
}

export async function paDirectoryGet(
  _request: NextRequest,
  ctx: RouteContext,
): Promise<Response> {
  const { getPADetail } = await import('@/lib/pa-directory')
  const params = await ctx.params
  const agentId = params.agentId
  if (!agentId) {
    return apiError('缺少 agentId', 400)
  }

  const result = await getPADetail(agentId)
  if (!result.ok) {
    return apiError(result.error, result.status)
  }

  return apiSuccess(result.data)
}
