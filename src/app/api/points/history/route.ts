import { NextRequest } from 'next/server'
import { getPointsHistory } from '@/lib/gamification'
import { apiError, apiListPage, AuthError, buildPagination, requireAuth } from '@/lib/api-utils'
import { reportApiError } from '@/lib/server-observability'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))

    const { transactions, total } = await getPointsHistory(user.id, page, limit)

    return apiListPage(transactions, buildPagination(page, limit, total))
  } catch (error) {
    if (error instanceof AuthError) {
      return error.response
    }
    reportApiError(request, error, 'points_history_query_failed')
    return apiError('查询失败', 500)
  }
}
