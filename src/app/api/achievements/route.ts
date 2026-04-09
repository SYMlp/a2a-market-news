import { NextRequest } from 'next/server'
import { reportApiError } from '@/lib/server-observability'
import { apiError, apiSuccess } from '@/lib/api-utils'
import { listAchievementDefs } from '@/lib/gamification'

export async function GET(request: NextRequest) {
  try {
    const defs = await listAchievementDefs()
    return apiSuccess(defs)
  } catch (error) {
    reportApiError(request, error, 'failed_to_fetch_achievements')
    return apiError('Failed to fetch achievements', 500)
  }
}
