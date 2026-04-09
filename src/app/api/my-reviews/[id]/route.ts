import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess, AuthError, ForbiddenError, requireAuth } from '@/lib/api-utils'
import { reportApiError } from '@/lib/server-observability'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()

    const { id } = await params

    const feedback = await prisma.appFeedback.findUnique({ where: { id } })
    if (!feedback) {
      return apiError('Review not found', 404)
    }

    if (feedback.agentId !== user.secondmeUserId) {
      throw new ForbiddenError('Not authorized to edit this review')
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
        return apiError('Rating must be between 1 and 5', 400)
      }
      updateData.overallRating = rating
    }
    if (status !== undefined) updateData.status = status

    const updated = await prisma.appFeedback.update({
      where: { id },
      data: updateData,
    })

    return apiSuccess({
      id: updated.id,
      overallRating: updated.overallRating,
      summary: updated.summary,
      source: updated.source,
      status: updated.status,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return error.response
    }
    if (error instanceof ForbiddenError) {
      return error.response
    }
    reportApiError(request, error, 'put_my_reviews_id_failed')
    return apiError('Failed to update review', 500)
  }
}
