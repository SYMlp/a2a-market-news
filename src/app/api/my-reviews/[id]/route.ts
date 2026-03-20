import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 })
    }

    const { id } = await params

    const feedback = await prisma.appFeedback.findUnique({ where: { id } })
    if (!feedback) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    if (feedback.agentId !== user.secondmeUserId) {
      return NextResponse.json({ error: 'Not authorized to edit this review' }, { status: 403 })
    }

    const body = await request.json()
    const { summary, overallRating, status } = body as {
      summary?: string
      overallRating?: number
      status?: string
    }

    const updateData: Record<string, unknown> = { source: 'human_edited' }
    if (summary !== undefined) updateData.summary = summary
    if (overallRating !== undefined) {
      const rating = Math.round(Number(overallRating))
      if (rating < 1 || rating > 5) {
        return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
      }
      updateData.overallRating = rating
    }
    if (status !== undefined) updateData.status = status

    const updated = await prisma.appFeedback.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        overallRating: updated.overallRating,
        summary: updated.summary,
        source: updated.source,
        status: updated.status,
      },
    })
  } catch (error) {
    console.error('PUT /api/my-reviews/[id] failed:', error)
    return NextResponse.json({ error: 'Failed to update review' }, { status: 500 })
  }
}
