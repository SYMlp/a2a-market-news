import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/circles
 * 获取所有圈子列表
 */
export async function GET(request: NextRequest) {
  try {
    const circles = await prisma.circle.findMany({
      include: {
        _count: {
          select: {
            appPAs: true,
            posts: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    return NextResponse.json({
      success: true,
      data: circles,
    })
  } catch (error) {
    console.error('获取圈子列表失败:', error)
    return NextResponse.json(
      { error: '获取失败' },
      { status: 500 }
    )
  }
}
