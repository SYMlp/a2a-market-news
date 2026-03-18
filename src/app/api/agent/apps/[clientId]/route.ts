import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateAgentToken } from '@/lib/agent-auth'

/**
 * GET /api/agent/apps/:clientId
 * Get app details by Client ID. Requires agent token.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const authError = validateAgentToken(request)
  if (authError) return authError

  try {
    const { clientId } = await params

    const app = await prisma.app.findUnique({
      where: { clientId },
      include: {
        circle: { select: { name: true, slug: true, type: true } },
        _count: { select: { feedbacks: true } },
      },
    })

    if (!app) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 })
    }

    const ratingAgg = await prisma.appFeedback.aggregate({
      where: { targetClientId: clientId },
      _avg: { overallRating: true },
      _count: true,
    })

    const recentFeedbacks = await prisma.appFeedback.findMany({
      where: { targetClientId: clientId, status: 'published' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        agentName: true,
        overallRating: true,
        summary: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: app.id,
        name: app.name,
        description: app.description,
        website: app.website,
        logo: app.logo,
        clientId: app.clientId,
        circle: app.circle,
        persona: app.persona,
        featured: app.featured,
        feedbackCount: ratingAgg._count,
        avgRating: Math.round((ratingAgg._avg.overallRating ?? 0) * 10) / 10,
        recentFeedbacks,
        createdAt: app.createdAt,
      },
    })
  } catch (error) {
    console.error('Agent app detail failed:', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }
}
