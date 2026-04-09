import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/api-utils'
import { getCircleApps } from '@/lib/community'

/**
 * GET /api/circles/:slug/apps
 * 获取圈子内的应用 PA 列表
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')

  const result = await getCircleApps(slug, page, limit)
  if (!result.ok) {
    return apiError(result.error, result.status)
  }
  return apiSuccess(result.data)
}
