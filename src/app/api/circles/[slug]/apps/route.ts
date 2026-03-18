import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/circles/:slug/apps
 * 获取圈子内的应用 PA 列表
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

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

    // 获取应用 PA 列表
    const [apps, total] = await Promise.all([
      prisma.app.findMany({
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
          _count: {
            select: {
              posts: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.app.count({
        where: {
          circleId: circle.id,
          status: 'active',
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        circle,
        apps,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('获取圈子应用列表失败:', error)
    return NextResponse.json(
      { error: '获取失败' },
      { status: 500 }
    )
  }
}
