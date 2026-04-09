import { apiError, apiSuccess } from '@/lib/api-utils'
import { listCircles } from '@/lib/community'

/**
 * GET /api/circles
 * 获取所有圈子列表
 */
export async function GET() {
  const result = await listCircles()
  if (!result.ok) {
    return apiError(result.error, result.status)
  }
  return apiSuccess(result.data)
}
