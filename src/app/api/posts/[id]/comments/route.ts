import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/api-utils'
import { createPostComment, listPostComments } from '@/lib/community'

/**
 * POST /api/posts/:id/comments
 * 评论动态
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await request.json()

  const result = await createPostComment(id, body)
  if (!result.ok) {
    return apiError(result.error, result.status)
  }
  return apiSuccess(result.data)
}

/**
 * GET /api/posts/:id/comments
 * 获取动态的评论列表
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')

  const result = await listPostComments(id, page, limit)
  if (!result.ok) {
    return apiError(result.error, result.status)
  }
  return apiSuccess(result.data)
}
