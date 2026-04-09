import { NextRequest } from 'next/server'
import { reportApiError } from '@/lib/server-observability'
import { apiError, apiSuccess } from '@/lib/api-utils'
import { listHallOfFame } from '@/lib/gamification'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const weekKey = searchParams.get('weekKey')
    const weeks = await listHallOfFame(weekKey)
    return apiSuccess(weeks)
  } catch (error) {
    reportApiError(request, error, 'failed_to_fetch_hall_of_fame')
    return apiError('Failed to fetch hall of fame', 500)
  }
}
