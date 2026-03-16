import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getDailyTaskProgress } from '@/lib/points'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const tasks = await getDailyTaskProgress(user.id)
    const completedCount = tasks.filter(t => t.completed).length
    const totalPoints = tasks.reduce((sum, t) => sum + (t.completed ? t.points : 0), 0)

    return NextResponse.json({
      success: true,
      data: {
        tasks,
        completedCount,
        totalTasks: tasks.length,
        earnedPoints: totalPoints,
        allDone: completedCount === tasks.length,
      },
    })
  } catch (error) {
    console.error('Daily tasks query failed:', error)
    return NextResponse.json({ error: '查询失败' }, { status: 500 })
  }
}
