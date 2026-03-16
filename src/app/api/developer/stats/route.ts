import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/**
 * GET /api/developer/stats
 * Aggregated feedback stats for the current developer
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 })
    }
    if (!user.isDeveloper) {
      return NextResponse.json({ error: 'Not a developer' }, { status: 403 })
    }

    const [totalApps, totalFeedbacks, avgRating, unreadCount, perApp] = await Promise.all([
      prisma.appPA.count({ where: { developerId: user.id } }),
      prisma.appFeedback.count({ where: { developerId: user.id } }),
      prisma.appFeedback.aggregate({
        where: { developerId: user.id },
        _avg: { overallRating: true },
      }),
      prisma.notificationLog.count({
        where: { developerId: user.id, channel: 'in_app', status: 'sent' },
      }),
      prisma.appFeedback.groupBy({
        by: ['targetClientId'],
        where: { developerId: user.id },
        _count: true,
        _avg: { overallRating: true },
      }),
    ])

    const appStats = await Promise.all(
      perApp.map(async (group) => {
        const app = await prisma.appPA.findFirst({
          where: { clientId: group.targetClientId },
          select: { name: true, clientId: true },
        })
        return {
          clientId: group.targetClientId,
          appName: app?.name ?? 'Unknown',
          feedbackCount: group._count,
          avgRating: Math.round((group._avg.overallRating ?? 0) * 10) / 10,
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: {
        totalApps,
        totalFeedbacks,
        avgRating: Math.round((avgRating._avg.overallRating ?? 0) * 10) / 10,
        unreadCount,
        appStats,
      },
    })
  } catch (error) {
    console.error('Developer stats failed:', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }
}
