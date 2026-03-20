import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const practice = await prisma.developerPractice.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    })

    if (!practice) {
      return NextResponse.json({ error: 'Practice not found' }, { status: 404 })
    }

    if (practice.status !== 'published') {
      return NextResponse.json({ error: 'Practice not found' }, { status: 404 })
    }

    await prisma.developerPractice.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    })

    return NextResponse.json({
      success: true,
      data: { ...practice, viewCount: practice.viewCount + 1 },
    })
  } catch (error) {
    console.error('Get practice detail failed:', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 })
    }

    const { id } = await params

    const practice = await prisma.developerPractice.findUnique({
      where: { id },
      select: { id: true, status: true },
    })

    if (!practice || practice.status !== 'published') {
      return NextResponse.json({ error: 'Practice not found' }, { status: 404 })
    }

    const updated = await prisma.developerPractice.update({
      where: { id },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true },
    })

    return NextResponse.json({ success: true, data: { likeCount: updated.likeCount } })
  } catch (error) {
    console.error('Like practice failed:', error)
    return NextResponse.json({ error: 'Like failed' }, { status: 500 })
  }
}
