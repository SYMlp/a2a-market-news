import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 })
    }

    const feedbacks = await prisma.appFeedback.findMany({
      where: { agentId: user.secondmeUserId },
      include: { app: { select: { name: true, clientId: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const data = feedbacks.map(f => ({
      id: f.id,
      appName: f.app?.name ?? f.targetClientId,
      appClientId: f.app?.clientId ?? f.targetClientId,
      overallRating: f.overallRating,
      summary: f.summary,
      source: f.source,
      status: f.status,
      createdAt: f.createdAt.toISOString(),
      payload: f.payload as Record<string, unknown> | null,
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('GET /api/my-reviews failed:', error)
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 })
  }
}
