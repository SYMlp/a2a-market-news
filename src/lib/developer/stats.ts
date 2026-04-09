import { prisma } from '@/lib/prisma'

export async function getDeveloperStats(developerId: string) {
  const [totalApps, totalFeedbacks, avgRating, unreadCount, perApp] = await Promise.all([
    prisma.app.count({ where: { developerId } }),
    prisma.appFeedback.count({ where: { developerId } }),
    prisma.appFeedback.aggregate({
      where: { developerId },
      _avg: { overallRating: true },
    }),
    prisma.notificationLog.count({
      where: { developerId, channel: 'in_app', status: 'sent' },
    }),
    prisma.appFeedback.groupBy({
      by: ['targetClientId'],
      where: { developerId },
      _count: true,
      _avg: { overallRating: true },
    }),
  ])

  const appStats = await Promise.all(
    perApp.map(async group => {
      const app = await prisma.app.findFirst({
        where: { clientId: group.targetClientId },
        select: { name: true, clientId: true },
      })
      return {
        clientId: group.targetClientId,
        appName: app?.name ?? 'Unknown',
        feedbackCount: group._count,
        avgRating: Math.round((group._avg.overallRating ?? 0) * 10) / 10,
      }
    }),
  )

  return {
    totalApps,
    totalFeedbacks,
    avgRating: Math.round((avgRating._avg.overallRating ?? 0) * 10) / 10,
    unreadCount,
    appStats,
  }
}
