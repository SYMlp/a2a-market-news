import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/api-utils'
import { getCircleLeaderboard } from '@/lib/community'

/**
 * GET /api/circles/:slug/leaderboard
 * 获取圈子排行榜
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const { searchParams } = new URL(request.url)
  const sortBy = searchParams.get('sortBy') || 'totalUsers'
  const limit = parseInt(searchParams.get('limit') || '50')

  const result = await getCircleLeaderboard(slug, sortBy, limit)
  if (!result.ok) {
    return apiError(result.error, result.status)
  }
  return apiSuccess(result.data)
}
