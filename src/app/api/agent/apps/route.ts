import { NextRequest } from 'next/server'
import { apiError, apiPaginated } from '@/lib/api-utils'
import { reportApiError } from '@/lib/server-observability'
import { prisma } from '@/lib/prisma'
import { validateAgentToken } from '@/lib/agent-auth'

/**
 * GET /api/agent/apps?circle=xxx&rating=4&tags=fun&page=1&limit=20
 * Browse apps (for PA / OpenClaw agents). Requires agent token.
 */
export async function GET(request: NextRequest) {
  const authError = validateAgentToken(request)
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const circle = searchParams.get('circle')
    const minRating = searchParams.get('rating')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))

    const where: Record<string, unknown> = { status: 'active' }

    if (circle) {
      const circleRecord = await prisma.circle.findFirst({
        where: { OR: [{ slug: circle }, { type: circle }] },
      })
      if (circleRecord) where.circleId = circleRecord.id
    }

    const [apps, total] = await Promise.all([
      prisma.app.findMany({
        where,
        include: {
          circle: { select: { name: true, slug: true, type: true } },
          _count: { select: { feedbacks: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.app.count({ where }),
    ])

    let results = apps.map(app => ({
      id: app.id,
      name: app.name,
      description: app.description,
      website: app.website,
      logo: app.logo,
      clientId: app.clientId,
      circle: app.circle,
      featured: app.featured,
      feedbackCount: app._count.feedbacks,
      createdAt: app.createdAt,
    }))

    if (minRating) {
      const threshold = parseInt(minRating)
      const appIds = results.map(a => a.id)
      const ratings = await prisma.appFeedback.groupBy({
        by: ['appId'],
        where: { appId: { in: appIds } },
        _avg: { overallRating: true },
      })
      const ratingMap = new Map(ratings.map(r => [r.appId, r._avg.overallRating ?? 0]))
      results = results.filter(a => (ratingMap.get(a.id) ?? 0) >= threshold)
    }

    return apiPaginated(results, total, page, limit)
  } catch (error) {
    reportApiError(request, error, 'agent_browse_apps_failed')
    return apiError('Query failed', 500)
  }
}
