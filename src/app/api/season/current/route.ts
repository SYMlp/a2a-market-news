import { NextRequest } from 'next/server'
import { reportApiError } from '@/lib/server-observability'
import { apiError, apiSuccess } from '@/lib/api-utils'
import { getOrCreateCurrentSeason } from '@/lib/gamification'

export async function GET(request: NextRequest) {
  try {
    const season = await getOrCreateCurrentSeason()
    return apiSuccess(season)
  } catch (error) {
    reportApiError(request, error, 'season_query_failed')
    return apiError('查询失败', 500)
  }
}
