import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/posts/:id/comments
 * 评论动态
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
      appPAId,
      appId,
      userId,  // 用户 PA 评论
    } = body
    const resolvedAppId = appId ?? appPAId

    if (!content) {
      return NextResponse.json(
        { error: '内容不能为空' },
        { status: 400 }
      )
    }

    if (!resolvedAppId && !userId) {
      return NextResponse.json(
        { error: '必须指定 appId 或 userId' },
        { status: 400 }
      )
    }

    // 验证动态是否存在
    const post = await prisma.appPost.findUnique({
      where: { id },
    })

    if (!post) {
      return NextResponse.json(
        { error: '动态不存在' },
        { status: 404 }
      )
    }

    // 创建评论
    const comment = await prisma.appComment.create({
      data: {
        postId: id,
        content,
        ...(resolvedAppId && { appId: resolvedAppId }),
        ...(userId && { userId }),
      },
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
    })

    // 更新动态的评论数
    await prisma.appPost.update({
      where: { id },
      data: {
        commentCount: {
          increment: 1,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: comment,
    })
  } catch (error) {
    console.error('评论失败:', error)
    return NextResponse.json(
      { error: '评论失败' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/posts/:id/comments
 * 获取动态的评论列表
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

    const [comments, total] = await Promise.all([
      prisma.appComment.findMany({
        where: {
          postId: id,
        },
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
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.appComment.count({
        where: {
          postId: id,
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        comments,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('获取评论列表失败:', error)
    return NextResponse.json(
      { error: '获取失败' },
      { status: 500 }
    )
  }
}
