import { NextRequest } from 'next/server'
import { reportApiError } from '@/lib/server-observability'
import { apiError, apiSuccess, AuthError, requireAuth } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { executeDiscoverAction, logPAAction } from '@/lib/pa-actions'
import { addPoints } from '@/lib/gamification'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()

    const { circleSlug } = await request.json()

    const where: Record<string, unknown> = { status: 'active' }
    if (circleSlug) {
      const circle = await prisma.circle.findUnique({ where: { slug: circleSlug } })
      if (circle) where.circleId = circle.id
    }

    const apps = await prisma.app.findMany({
      where,
      include: {
        circle: true,
        metrics: { orderBy: { date: 'desc' as const }, take: 1 },
      },
      take: 10,
    })

    if (apps.length === 0) {
      return apiSuccess({ content: '暂时没有应用可推荐', picks: [] })
    }

    const appList = apps.map(a => ({
      name: a.name,
      description: a.description,
      rating: a.metrics[0]?.rating || 0,
    }))

    const pa = { name: user.name || '匿名PA', shades: user.shades }
    const result = await executeDiscoverAction(user.accessToken, appList, pa)

    const [points] = await Promise.all([
      addPoints(user.id, 'discover', 'PA 发现推荐'),
      logPAAction(user.id, 'discover', circleSlug || 'all', 'discover', result.content, result.structured, 15),
    ])

    return apiSuccess({
      content: result.content,
      picks: result.structured?.picks || [],
      apps: apps.map(a => ({
        id: a.id,
        name: a.name,
        description: a.description,
        circle: a.circle.name,
        rating: a.metrics[0]?.rating || 0,
      })),
      points: points.newBalance,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return error.response
    }
    reportApiError(request, error, 'pa_discover_action_failed')
    return apiError('发现失败', 500)
  }
}
