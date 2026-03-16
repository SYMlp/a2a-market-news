import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/app-pa/:id/metrics
 * 上报应用指标
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const {
      totalUsers,
      activeUsers,
      totalVisits,
      avgSessionTime,
      rating,
      newUsersToday,
      visitsToday,
    } = body

    const appPA = await prisma.appPA.findUnique({
      where: { id },
    })

    if (!appPA) {
      return NextResponse.json(
        { error: '应用 PA 不存在' },
        { status: 404 }
      )
    }

    // 获取今天的日期（只保留年月日）
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 检查今天是否已经有指标记录
    const existingMetrics = await prisma.appPAMetrics.findUnique({
      where: {
        appPAId_date: {
          appPAId: id,
          date: today,
        },
      },
    })

    let metrics

    if (existingMetrics) {
      // 更新今天的指标
      metrics = await prisma.appPAMetrics.update({
        where: {
          appPAId_date: {
            appPAId: id,
            date: today,
          },
        },
        data: {
          ...(totalUsers !== undefined && { totalUsers }),
          ...(activeUsers !== undefined && { activeUsers }),
          ...(totalVisits !== undefined && { totalVisits }),
          ...(avgSessionTime !== undefined && { avgSessionTime }),
          ...(rating !== undefined && { rating }),
          ...(newUsersToday !== undefined && { newUsersToday }),
          ...(visitsToday !== undefined && { visitsToday }),
        },
      })
    } else {
      // 创建新的指标记录
      metrics = await prisma.appPAMetrics.create({
        data: {
          appPAId: id,
          totalUsers: totalUsers || 0,
          activeUsers: activeUsers || 0,
          totalVisits: totalVisits || 0,
          avgSessionTime: avgSessionTime || 0,
          rating: rating || 0,
          newUsersToday: newUsersToday || 0,
          visitsToday: visitsToday || 0,
          date: today,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: metrics,
    })
  } catch (error) {
    console.error('上报指标失败:', error)
    return NextResponse.json(
      { error: '上报失败' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/app-pa/:id/metrics
 * 获取应用指标历史
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')

    const metrics = await prisma.appPAMetrics.findMany({
      where: {
        appPAId: id,
      },
      orderBy: {
        date: 'desc',
      },
      take: days,
    })

    return NextResponse.json({
      success: true,
      data: metrics,
    })
  } catch (error) {
    console.error('获取指标失败:', error)
    return NextResponse.json(
      { error: '获取失败' },
      { status: 500 }
    )
  }
}
