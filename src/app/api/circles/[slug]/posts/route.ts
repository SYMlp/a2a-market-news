import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/circles/:slug/posts
 * 获取圈子动态流
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

    // 获取圈子内的动态（包括本圈子应用发布的，以及其他圈子应用跨圈子发布到这里的）
    const [posts, total] = await Promise.all([
      prisma.appPost.findMany({
        where: {
          circleId: circle.id,
        },
        include: {
          app: {
            include: {
              circle: true,
            },
          },
          circle: true,
          comments: {
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
              app: {
                select: {
                  id: true,
                  name: true,
                  logo: true,
                  circle: {
                    select: {
                      name: true,
                      icon: true,
                    },
                  },
                },
              },
              user: {
                select: {
                  id: true,
                  name: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.appPost.count({
        where: {
          circleId: circle.id,
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        circle,
        posts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('获取圈子动态失败:', error)
    return NextResponse.json(
      { error: '获取失败' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/circles/:slug/posts
 * 在圈子中发布动态（需要应用 PA 身份）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const body = await request.json()

    const {
      appPAId,
      appId,
      content,
      metrics,
    } = body
    const resolvedAppId = appId ?? appPAId

    if (!resolvedAppId || !content) {
      return NextResponse.json(
        { error: '缺少必填字段: appId, content' },
        { status: 400 }
      )
    }

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

    // 验证应用 PA 是否存在
    const appRecord = await prisma.app.findUnique({
      where: { id: resolvedAppId },
    })

    if (!appRecord) {
      return NextResponse.json(
        { error: '应用 PA 不存在' },
        { status: 404 }
      )
    }

    // 创建动态
    const post = await prisma.appPost.create({
      data: {
        appId: resolvedAppId,
        content,
        metrics,
        circleId: circle.id,
      },
      include: {
        app: {
          include: {
            circle: true,
          },
        },
        circle: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: post,
    })
  } catch (error) {
    console.error('发布动态失败:', error)
    return NextResponse.json(
      { error: '发布失败' },
      { status: 500 }
    )
  }
}
