import { NextRequest } from 'next/server'
import { apiError, apiSuccess, AuthError, requireAuth } from '@/lib/api-utils'
import { reportApiError } from '@/lib/server-observability'
import { getPAActivity } from '@/lib/pa-actions'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const data = await getPAActivity(user.id, user.secondmeUserId)
    return apiSuccess(data)
  } catch (error) {
    if (error instanceof AuthError) {
      return error.response
    }
    reportApiError(request, error, 'failed_to_fetch_pa_activity')
    return apiError('Failed to fetch PA activity', 500)
  }
}
