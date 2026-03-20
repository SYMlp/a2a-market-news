import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/circles/:slug/leaderboard
 * 获取圈子排行榜
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { searchParams } = new URL(request.url)
    const sortBy = searchParams.get('sortBy') || 'totalUsers' // totalUsers, activeUsers, rating, totalVisits
    const limit = parseInt(searchParams.get('limit') || '50')

    // 查找圈子
    const circle = await prisma.circle.findUnique({
      where: { slug },
    })

    if (!circle) {
      return NextResponse.json(
        { error: '圈子不存在' },
        { status: 404 }
      )
    }

    // 获取圈子内所有应用 PA 及其最新指标
    const apps = await prisma.app.findMany({
      where: {
        circleId: circle.id,
        status: 'active',
      },
      include: {
        developer: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        metrics: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    })

    // 根据指标排序
    const sortedApps = apps
      .filter(app => app.metrics.length > 0)
      .map((app) => ({
        ...app,
        latestMetrics: app.metrics[0],
      }))
      .sort((a, b) => {
        if (sortBy === 'votes') {
          return (b.voteCount ?? 0) - (a.voteCount ?? 0)
        }
        const aValue = a.latestMetrics[sortBy as keyof typeof a.latestMetrics] as number || 0
        const bValue = b.latestMetrics[sortBy as keyof typeof b.latestMetrics] as number || 0
        return bValue - aValue
      })
      .slice(0, limit)
      .map((app, index) => ({
        rank: index + 1,
        ...app,
      }))

    // 计算圈子总体数据
    const circleStats = {
      totalApps: apps.length,
      totalUsers: apps.reduce((sum, app) => {
        const metrics = app.metrics[0]
        return sum + (metrics?.totalUsers || 0)
      }, 0),
      avgRating: apps.reduce((sum, app) => {
        const metrics = app.metrics[0]
        return sum + (metrics?.rating || 0)
      }, 0) / apps.length || 0,
    }

    return NextResponse.json({
      success: true,
      data: {
        circle,
        stats: circleStats,
        leaderboard: sortedApps,
        sortBy,
      },
    })
  } catch (error) {
    console.error('获取圈子排行榜失败:', error)
    return NextResponse.json(
      { error: '获取失败' },
      { status: 500 }
    )
  }
}
