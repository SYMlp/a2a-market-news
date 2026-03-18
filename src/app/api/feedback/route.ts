import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateFeedback, type FeedbackPayload } from '@/lib/feedback-schema'
import { notifyDeveloper } from '@/lib/notification'
import { getCurrentUser } from '@/lib/auth'
import { processAchievements } from '@/lib/achievement'

/**
 * POST /api/feedback
 * Submit structured feedback (JSON Schema validated).
 * Logged-in users: agentId/agentName/agentType auto-filled from session (human feedback).
 * Anonymous / agent callers: must provide agentId/agentName/agentType in body.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const user = await getCurrentUser().catch(() => null)

    if (user) {
      body.agentId = body.agentId ?? user.id
      body.agentName = body.agentName ?? (user.name || user.email || 'Anonymous')
      body.agentType = body.agentType ?? 'human'
    }

    const result = validateFeedback(body)

    if (!result.valid) {
      return NextResponse.json(
        { error: 'Feedback validation failed', details: result.errors },
        { status: 400 }
      )
    }

    const payload = body as FeedbackPayload

    const appRecord = await prisma.app.findUnique({
      where: { clientId: payload.targetClientId },
      include: { developer: true },
    })

    const feedback = await prisma.appFeedback.create({
      data: {
        targetClientId: payload.targetClientId,
        appId: appRecord?.id ?? null,
        developerId: appRecord?.developerId ?? null,
        agentId: payload.agentId,
        agentName: payload.agentName,
        agentType: payload.agentType,
        payload: body,
        overallRating: payload.overallRating,
        summary: payload.summary,
        source: user ? 'human_comment' : 'direct_api',
      },
    })

    if (appRecord?.developerId) {
      notifyDeveloper({
        developerId: appRecord.developerId,
        feedbackId: feedback.id,
        appClientId: payload.targetClientId,
        appName: appRecord.name,
        summary: payload.summary,
        overallRating: payload.overallRating,
      }).catch(err => console.error('Notification failed:', err))
    }

    const achievements = await processAchievements(
      payload.agentId, payload.agentName, payload.agentType, payload.targetClientId
    ).catch(err => { console.error('Achievement check failed:', err); return { newUnlocks: [] } })

    return NextResponse.json({ success: true, data: feedback, achievements: achievements.newUnlocks })
  } catch (error) {
    console.error('Feedback submission failed:', error)
    return NextResponse.json({ error: 'Submission failed' }, { status: 500 })
  }
}

/**
 * GET /api/feedback?clientId=xxx&agentId=xxx&page=1&limit=20
 * Query feedback by clientId or agentId
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const agentId = searchParams.get('agentId')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))

    const where: Record<string, unknown> = { status: 'published' }
    if (clientId) where.targetClientId = clientId
    if (agentId) where.agentId = agentId

    const [feedbacks, total] = await Promise.all([
      prisma.appFeedback.findMany({
        where,
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
    console.error('Feedback query failed:', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }
}
