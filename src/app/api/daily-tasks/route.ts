import { NextRequest } from 'next/server'
import { getDailyTaskProgress } from '@/lib/gamification'
import { apiError, apiSuccess, AuthError, requireAuth } from '@/lib/api-utils'
import { reportApiError } from '@/lib/server-observability'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    const tasks = await getDailyTaskProgress(user.id)
    const completedCount = tasks.filter(t => t.completed).length
    const totalPoints = tasks.reduce((sum, t) => sum + (t.completed ? t.points : 0), 0)

    return apiSuccess({
      tasks,
      completedCount,
      totalTasks: tasks.length,
      earnedPoints: totalPoints,
      allDone: completedCount === tasks.length,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return error.response
    }
    reportApiError(request, error, 'daily_tasks_query_failed')
    return apiError('查询失败', 500)
  }
}
