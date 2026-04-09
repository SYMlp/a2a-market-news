import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/api-utils'
import { simulateCircleDiscussion } from '@/lib/community'

/**
 * POST /api/circles/:slug/simulate-discussion
 * 模拟应用 PA 之间的讨论（用于演示）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const body = await request.json()
  const { topic } = body as { topic?: string }

  const result = await simulateCircleDiscussion(slug, topic)
  if (!result.ok) {
    return apiError(result.error, result.status)
  }
  return apiSuccess(result.data)
}
