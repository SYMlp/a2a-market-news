import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/api-utils'
import { reportApiError } from '@/lib/server-observability'

/**
 * GET /api/gm/recommend
 * Returns top apps for the News Space, ranked by activity score.
 * Score = feedbackCount * 2 + avgRating * 3 + recentFeedback7d * 5 + voteCount * 1.5
 * Falls back to createdAt desc when all scores are 0 (cold start).
 */
export async function GET(request: NextRequest) {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const apps = await prisma.app.findMany({
      where: { status: 'active' },
      include: {
        circle: { select: { name: true, type: true } },
        metrics: {
          orderBy: { date: 'desc' },
          take: 1,
        },
        _count: { select: { feedbacks: true } },
        feedbacks: {
          where: { createdAt: { gte: sevenDaysAgo } },
          select: { id: true },
        },
      },
    })

    const scored = apps.map(app => {
      const feedbackCount = app._count.feedbacks
      const avgRating = app.metrics[0]?.rating ?? 0
      const recentCount = app.feedbacks.length
      const votes = app.voteCount ?? 0
      const score = feedbackCount * 2 + avgRating * 3 + recentCount * 5 + votes * 1.5
      return { app, score, feedbackCount, avgRating, recentCount, votes }
    })

    const hasActivity = scored.some(s => s.score > 0)
    scored.sort((a, b) =>
      hasActivity
        ? b.score - a.score
        : b.app.createdAt.getTime() - a.app.createdAt.getTime()
    )

    /* Cap at 6 — matches scene layout `maxAppDockItems` (see configs.json / scene-layout-architecture.md) */
    const top = scored.slice(0, 6)

    const formatted = top.map((s, i) => ({
      index: i + 1,
      id: s.app.id,
      name: s.app.name,
      description: s.app.description,
      website: s.app.website,
      clientId: s.app.clientId,
      circle: s.app.circle?.name || '',
      circleType: s.app.circle?.type || '',
      feedbackCount: s.feedbackCount,
      rating: s.avgRating,
      score: Math.round(s.score * 10) / 10,
    }))

    const appsList = formatted
      .map(a => `${a.index}. ${a.name} — ${a.description}`)
      .join('\n')

    const appsJson = JSON.stringify(
      formatted.map(a => ({
        name: a.name,
        clientId: a.clientId,
        description: a.description,
        rating: a.rating,
        website: a.website,
      }))
    )

    const hasApps = formatted.length > 0

    return apiSuccess({
      apps: formatted,
      hasApps,
      apps_list: appsList,
      apps_json: appsJson,
      apps_greeting: hasApps
        ? `这是最近最受欢迎的 A2A 应用：\n${appsList}`
        : '目前还没有应用入驻，平台刚开张呢。',
      apps_hint: hasApps
        ? '想体验哪个？体验完回来告诉我感受，我会把你的建议转达给开发者。'
        : '你可以先回大厅，去开发者空间把你做的应用推荐给我们，抢个头彩！',
    })
  } catch (error) {
    reportApiError(request, error, 'gm_recommend_error')
    return apiError('获取推荐失败', 500)
  }
}
