import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/**
 * GET /api/developer/feedbacks?clientId=xxx&page=1&limit=20
 * All feedback for the current developer's apps
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 })
    }
    if (!user.isDeveloper) {
      return NextResponse.json({ error: 'Not a developer' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))

    const where: Record<string, unknown> = { developerId: user.id }
    if (clientId) where.targetClientId = clientId

    const [feedbacks, total] = await Promise.all([
      prisma.appFeedback.findMany({
        where,
        include: { appPA: { select: { name: true, clientId: true, logo: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.appFeedback.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: feedbacks,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Developer feedbacks query failed:', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }
}
