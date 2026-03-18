import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/app-pa/:id/posts
 * 应用 PA 发布动态
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const {
      content,
      metrics, // 可选的指标展示
      targetCircleSlug, // 跨圈子发布
    } = body

    if (!content) {
      return NextResponse.json(
        { error: '内容不能为空' },
        { status: 400 }
      )
    }

    // 验证应用 PA 是否存在
    const appRecord = await prisma.app.findUnique({
      where: { id },
      include: { circle: true },
    })

    if (!appRecord) {
      return NextResponse.json(
        { error: '应用 PA 不存在' },
        { status: 404 }
      )
    }

    // 如果指定了目标圈子，查找圈子 ID
    let targetCircleId = appRecord.circleId // 默认发布到自己的圈子

    if (targetCircleSlug) {
      const targetCircle = await prisma.circle.findUnique({
        where: { slug: targetCircleSlug },
      })

      if (targetCircle) {
        targetCircleId = targetCircle.id
      }
    }

    // 创建动态
    const post = await prisma.appPost.create({
      data: {
        appId: id,
        content,
        metrics,
        circleId: targetCircleId,
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

/**
 * GET /api/app-pa/:id/posts
 * 获取应用 PA 的动态列表
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const [posts, total] = await Promise.all([
      prisma.appPost.findMany({
        where: {
          appId: id,
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
          appId: id,
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
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
    console.error('获取动态列表失败:', error)
    return NextResponse.json(
      { error: '获取失败' },
      { status: 500 }
    )
  }
}
