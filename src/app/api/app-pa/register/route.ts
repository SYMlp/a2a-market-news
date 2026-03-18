import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/**
 * POST /api/app-pa/register
 * Register a new App PA. Requires login; auto-assigns developerId from session.
 * Required fields: name, description, circleType
 * Optional: website, logo, persona, metadata (including clientId)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      )
    }

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
      return NextResponse.json(
        { error: '缺少必填字段: name, description, circleType' },
        { status: 400 }
      )
    }

    const circle = await prisma.circle.findUnique({
      where: { type: circleType },
    })

    if (!circle) {
      return NextResponse.json(
        { error: `圈子不存在: ${circleType}` },
        { status: 404 }
      )
    }

    const clientId = metadata?.clientId || `app-${crypto.randomUUID().slice(0, 8)}`
    const existingClient = await prisma.app.findUnique({ where: { clientId } })
    if (existingClient) {
      return NextResponse.json({ error: 'Client ID 已被注册' }, { status: 409 })
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

    return NextResponse.json({
      success: true,
      data: app,
    })
  } catch (error) {
    console.error('应用 PA 注册失败:', error)
    return NextResponse.json(
      { error: '注册失败' },
      { status: 500 }
    )
  }
}
