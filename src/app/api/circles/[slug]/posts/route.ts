import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/api-utils'
import { createCirclePost, getCirclePosts } from '@/lib/community'

/**
 * GET /api/circles/:slug/posts
 * 获取圈子动态流
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')

  const result = await getCirclePosts(slug, page, limit)
  if (!result.ok) {
    return apiError(result.error, result.status)
  }
  return apiSuccess(result.data)
}

/**
 * POST /api/circles/:slug/posts
 * 在圈子中发布动态（需要应用 PA 身份）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const body = await request.json()

  const result = await createCirclePost(slug, body)
  if (!result.ok) {
    return apiError(result.error, result.status)
  }
  return apiSuccess(result.data)
}
