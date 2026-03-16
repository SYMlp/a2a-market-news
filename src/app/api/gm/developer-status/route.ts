import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/gm/developer-status
 * Returns developer's feedback status for the Developer Space.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const apps = await prisma.appPA.findMany({
      where: { developerId: user.id },
      select: { id: true, name: true, clientId: true },
    })

    if (apps.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          hasApps: false,
          feedback_status: '你还没有注册应用。要注册一个吗？',
          feedback_summary: 'No apps registered.',
          feedbacks: [],
        },
      })
    }

    const appIds = apps.map(a => a.id)
    const feedbacks = await prisma.appFeedback.findMany({
      where: { appPAId: { in: appIds } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        agentName: true,
        summary: true,
        overallRating: true,
        createdAt: true,
        appPAId: true,
      },
    })

    const feedbackList = feedbacks.length > 0
      ? feedbacks.map((f, i) => {
          const app = apps.find(a => a.id === f.appPAId)
          return `${i + 1}. [${app?.name || '应用'}] ${f.agentName}: "${f.summary}" (${f.overallRating}/5)`
        }).join('\n')
      : '暂无反馈'

    const feedbackJson = JSON.stringify(
      feedbacks.map(f => ({
        id: f.id,
        agent: f.agentName,
        summary: f.summary,
        rating: f.overallRating,
        date: f.createdAt,
      }))
    )

    return NextResponse.json({
      success: true,
      data: {
        hasApps: true,
        appCount: apps.length,
        feedbackCount: feedbacks.length,
        feedback_status: feedbacks.length > 0
          ? `你有 ${feedbacks.length} 条用户建议！`
          : '目前没有新的用户建议。',
        feedback_summary: `${apps.length} apps, ${feedbacks.length} feedbacks.`,
        feedback_list: feedbackList,
        feedback_json: feedbackJson,
        feedbacks,
      },
    })
  } catch (error) {
    console.error('GM developer-status error:', error)
    return NextResponse.json({ error: '获取状态失败' }, { status: 500 })
  }
}
