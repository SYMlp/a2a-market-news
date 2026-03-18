import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/app-pa/:id
 * 获取应用 PA 详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const app = await prisma.app.findUnique({
      where: { id },
      include: {
        circle: true,
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
        posts: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            comments: {
              take: 3,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    })

    if (!app) {
      return NextResponse.json(
        { error: '应用 PA 不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: app,
    })
  } catch (error) {
    console.error('获取应用 PA 失败:', error)
    return NextResponse.json(
      { error: '获取失败' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/app-pa/:id
 * 更新应用 PA 信息
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const {
      name,
      description,
      website,
      logo,
      persona,
      status,
      shortPrompt,
      detailedPrompt,
      systemSummary,
    } = body

    const existing = await prisma.app.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: '应用 PA 不存在' },
        { status: 404 }
      )
    }

    const app = await prisma.app.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(website !== undefined && { website }),
        ...(logo !== undefined && { logo }),
        ...(persona && { persona }),
        ...(status && { status }),
        ...(shortPrompt !== undefined && { shortPrompt }),
        ...(detailedPrompt !== undefined && { detailedPrompt }),
        ...(systemSummary !== undefined && { systemSummary }),
      },
      include: {
        circle: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: app,
    })
  } catch (error) {
    console.error('更新应用 PA 失败:', error)
    return NextResponse.json(
      { error: '更新失败' },
      { status: 500 }
    )
  }
}
