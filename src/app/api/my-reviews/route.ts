import { NextRequest } from 'next/server'
import { apiError, apiSuccess, AuthError, requireAuth } from '@/lib/api-utils'
import { reportApiError } from '@/lib/server-observability'
import { listMyReviews } from '@/lib/pa-actions'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const data = await listMyReviews(user.secondmeUserId)
    return apiSuccess(data)
  } catch (error) {
    if (error instanceof AuthError) {
      return error.response
    }
    reportApiError(request, error, 'get_my_reviews_failed')
    return apiError('Failed to fetch reviews', 500)
  }
}
