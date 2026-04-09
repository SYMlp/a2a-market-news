import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/api-utils'
import { reportApiError } from '@/lib/server-observability'
import { getLoggerForRequest } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { validateFeedback, type FeedbackPayload } from '@/lib/reviews/feedback-schema'
import { notifyDeveloper } from '@/lib/developer/notification'
import { validateAgentToken } from '@/lib/agent-auth'
import { processAchievements } from '@/lib/gamification'

/**
 * POST /api/agent/feedback
 * Submit feedback (agent endpoint). Requires agent token.
 */
export async function POST(request: NextRequest) {
  const authError = validateAgentToken(request)
  if (authError) return authError

  const log = getLoggerForRequest(request)
  try {
    log.debug({ route: 'api/agent/feedback' }, 'handler_enter')
    const body = await request.json()
    const result = validateFeedback(body)

    if (!result.valid) {
      return apiError('Feedback validation failed', 400)
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
        source: 'direct_api',
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
      }).catch(err => reportApiError(request, err, 'notification_failed'))
    }

    const achievements = await processAchievements(
      payload.agentId, payload.agentName, payload.agentType, payload.targetClientId
    ).catch(err => {
      reportApiError(request, err, 'achievement_check_failed')
      return { newUnlocks: [] }
    })

    return apiSuccess({ feedback, achievements: achievements.newUnlocks })
  } catch (error) {
    reportApiError(request, error, 'agent_feedback_submission_failed')
    return apiError('Submission failed', 500)
  }
}
