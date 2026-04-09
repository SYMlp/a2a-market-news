import { NextRequest } from 'next/server'
import { listDeveloperFeedbacks } from '@/lib/developer/feedbacks'
import {
  apiError,
  apiPaginated,
  AuthError,
  ForbiddenError,
  requireAuth,
  requireDeveloper,
} from '@/lib/api-utils'
import { reportApiError } from '@/lib/server-observability'

/**
 * GET /api/developer/feedbacks?appId=xxx&page=1&limit=20
 * Supports appId (preferred) or clientId (backward compat) for filtering.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    requireDeveloper(user)

    const { searchParams } = new URL(request.url)
    const appId = searchParams.get('appId')
    const clientId = searchParams.get('clientId')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))

    const { feedbacks, total } = await listDeveloperFeedbacks(user.id, {
      appId,
      clientId,
      page,
      limit,
    })

    return apiPaginated(feedbacks, total, page, limit)
  } catch (error) {
    if (error instanceof AuthError) {
      return error.response
    }
    if (error instanceof ForbiddenError) {
      return error.response
    }
    reportApiError(request, error, 'developer_feedbacks_query_failed')
    return apiError('Query failed', 500)
  }
}
