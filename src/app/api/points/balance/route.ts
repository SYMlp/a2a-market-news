import { NextRequest } from 'next/server'
import { getPointsBalance } from '@/lib/gamification'
import { apiError, apiSuccess, AuthError, requireAuth } from '@/lib/api-utils'
import { reportApiError } from '@/lib/server-observability'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    const balance = await getPointsBalance(user.id)

    return apiSuccess({ balance })
  } catch (error) {
    if (error instanceof AuthError) {
      return error.response
    }
    reportApiError(request, error, 'points_balance_query_failed')
    return apiError('查询失败', 500)
  }
}
