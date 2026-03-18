import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { executeDiscoverAction, logPAAction } from '@/lib/pa-engine'
import { addPoints } from '@/lib/points'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

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
      return NextResponse.json({
        success: true,
        data: { content: '暂时没有应用可推荐', picks: [] },
      })
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

    return NextResponse.json({
      success: true,
      data: {
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
      },
    })
  } catch (error) {
    console.error('PA discover action failed:', error)
    return NextResponse.json({ error: '发现失败' }, { status: 500 })
  }
}
