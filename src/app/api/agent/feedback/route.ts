import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateFeedback, type FeedbackPayload } from '@/lib/feedback-schema'
import { notifyDeveloper } from '@/lib/notification'
import { validateAgentToken } from '@/lib/agent-auth'
import { processAchievements } from '@/lib/achievement'

/**
 * POST /api/agent/feedback
 * Submit feedback (agent endpoint). Requires agent token.
 */
export async function POST(request: NextRequest) {
  const authError = validateAgentToken(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const result = validateFeedback(body)

    if (!result.valid) {
      return NextResponse.json(
        { error: 'Feedback validation failed', details: result.errors },
        { status: 400 }
      )
    }

    const payload = body as FeedbackPayload

    const appPA = await prisma.appPA.findUnique({
      where: { clientId: payload.targetClientId },
      include: { developer: true },
    })

    const feedback = await prisma.appFeedback.create({
      data: {
        targetClientId: payload.targetClientId,
        appPAId: appPA?.id ?? null,
        developerId: appPA?.developerId ?? null,
        agentId: payload.agentId,
        agentName: payload.agentName,
        agentType: payload.agentType,
        payload: body,
        overallRating: payload.overallRating,
        summary: payload.summary,
        source: 'direct_api',
      },
    })

    if (appPA?.developerId) {
      notifyDeveloper({
        developerId: appPA.developerId,
        feedbackId: feedback.id,
        appClientId: payload.targetClientId,
        appName: appPA.name,
        summary: payload.summary,
        overallRating: payload.overallRating,
      }).catch(err => console.error('Notification failed:', err))
    }

    const achievements = await processAchievements(
      payload.agentId, payload.agentName, payload.agentType, payload.targetClientId
    ).catch(err => { console.error('Achievement check failed:', err); return { newUnlocks: [] } })

    return NextResponse.json({ success: true, data: feedback, achievements: achievements.newUnlocks })
  } catch (error) {
    console.error('Agent feedback submission failed:', error)
    return NextResponse.json({ error: 'Submission failed' }, { status: 500 })
  }
}
