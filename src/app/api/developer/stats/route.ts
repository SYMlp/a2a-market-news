import { NextRequest } from 'next/server'
import { getDeveloperStats } from '@/lib/developer/stats'
import {
  apiError,
  apiSuccess,
  AuthError,
  ForbiddenError,
  requireAuth,
  requireDeveloper,
} from '@/lib/api-utils'
import { reportApiError } from '@/lib/server-observability'

/**
 * GET /api/developer/stats
 * Aggregated feedback stats for the current developer
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    requireDeveloper(user)

    const data = await getDeveloperStats(user.id)

    return apiSuccess(data)
  } catch (error) {
    if (error instanceof AuthError) {
      return error.response
    }
    if (error instanceof ForbiddenError) {
      return error.response
    }
    reportApiError(request, error, 'developer_stats_failed')
    return apiError('Query failed', 500)
  }
}
