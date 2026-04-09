import { NextRequest } from 'next/server'
import { reportApiError } from '@/lib/server-observability'
import { apiError, apiSuccess } from '@/lib/api-utils'
import { getLatestHallOfFame } from '@/lib/gamification'

export async function GET(request: NextRequest) {
  try {
    const result = await getLatestHallOfFame()
    return apiSuccess(result)
  } catch (error) {
    reportApiError(request, error, 'failed_to_fetch_latest_hall_of_fame')
    return apiError('Failed to fetch latest hall of fame', 500)
  }
}
