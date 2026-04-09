import { NextRequest } from 'next/server'
import { reportApiError } from '@/lib/server-observability'
import { apiError, apiSuccess } from '@/lib/api-utils'
import { getAgentAchievements } from '@/lib/gamification'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params
    const result = await getAgentAchievements(agentId)
    return apiSuccess(result)
  } catch (error) {
    reportApiError(_request, error, 'failed_to_fetch_agent_achievements')
    return apiError('Failed to fetch achievements', 500)
  }
}
