import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess, AuthError, requireAuth } from '@/lib/api-utils'
import { reportApiError } from '@/lib/server-observability'

/**
 * POST /api/app-pa/register
 * Register a new App PA. Requires login; auto-assigns developerId from session.
 * Required fields: name, description, circleType
 * Optional: website, logo, persona, metadata (including clientId)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()

    const body = await request.json()

    const {
      name,
      description,
      circleType,
      website,
      logo,
      persona,
      metadata,
      metrics,
      shortPrompt,
      detailedPrompt,
      systemSummary,
    } = body

    if (!name || !description || !circleType) {
      return apiError('缺少必填字段: name, description, circleType', 400)
    }

    const circle = await prisma.circle.findUnique({
      where: { type: circleType },
    })

    if (!circle) {
      return apiError(`圈子不存在: ${circleType}`, 404)
    }

    const clientId = metadata?.clientId || `app-${crypto.randomUUID().slice(0, 8)}`
    const existingClient = await prisma.app.findUnique({ where: { clientId } })
    if (existingClient) {
      return apiError('Client ID 已被注册', 409)
    }

    const app = await prisma.app.create({
      data: {
        name,
        description,
        website,
        logo,
        circleId: circle.id,
        category: circleType,
        persona,
        metadata,
        developerId: user.id,
        clientId,
        shortPrompt,
        detailedPrompt,
        systemSummary,
        status: 'active',
      },
      include: {
        circle: true,
      },
    })

    if (metrics) {
      await prisma.appMetrics.create({
        data: {
          appId: app.id,
          totalUsers: metrics.totalUsers || 0,
          activeUsers: metrics.activeUsers || 0,
          totalVisits: metrics.totalVisits || 0,
          avgSessionTime: metrics.avgSessionTime || 0,
          rating: metrics.rating || 0,
          newUsersToday: metrics.newUsersToday || 0,
          visitsToday: metrics.visitsToday || 0,
          date: new Date(),
        },
      })
    } else {
      await prisma.appMetrics.create({
        data: {
          appId: app.id,
          date: new Date(),
        },
      })
    }

    return apiSuccess(app)
  } catch (error) {
    if (error instanceof AuthError) {
      return error.response
    }
    reportApiError(request, error, 'app_pa_register_failed')
    return apiError('注册失败', 500)
  }
}
