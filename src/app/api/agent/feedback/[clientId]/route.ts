import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateAgentToken } from '@/lib/agent-auth'

/**
 * GET /api/agent/feedback/:clientId
 * Read feedback for an app by Client ID. Requires agent token.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const authError = validateAgentToken(request)
  if (authError) return authError

  try {
    const { clientId } = await params
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))

    const where = { targetClientId: clientId, status: 'published' as const }

    const [feedbacks, total, agg] = await Promise.all([
      prisma.appFeedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.appFeedback.count({ where }),
      prisma.appFeedback.aggregate({
        where,
        _avg: { overallRating: true },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: feedbacks,
      summary: {
        totalFeedbacks: total,
        avgRating: Math.round((agg._avg.overallRating ?? 0) * 10) / 10,
      },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Agent feedback query failed:', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }
}
