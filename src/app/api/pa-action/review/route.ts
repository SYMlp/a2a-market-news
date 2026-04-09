import { NextRequest } from 'next/server'
import { reportApiError } from '@/lib/server-observability'
import { getLoggerForRequest } from '@/lib/logger'
import { apiError, apiSuccess, AuthError, requireAuth } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { executeReviewAction } from '@/lib/pa-actions'
import { rewardReview } from '@/lib/gamification'

export async function POST(request: NextRequest) {
  const log = getLoggerForRequest(request)
  try {
    log.debug({ route: 'api/pa-action/review' }, 'handler_enter')
    const user = await requireAuth()

    const { appPAId, appId, clientId, confirm, editedContent, editedRating } = await request.json()
    const lookupId = appPAId ?? appId

    if (!lookupId && !clientId) {
      return apiError('缺少 appId/appPAId 或 clientId', 400)
    }

    const appRecord = lookupId
      ? await prisma.app.findUnique({ where: { id: lookupId }, include: { circle: true, developer: true } })
      : await prisma.app.findUnique({ where: { clientId }, include: { circle: true, developer: true } })

    if (!appRecord) {
      return apiError('应用不存在', 404)
    }

    const pa = {
      name: user.name || '匿名PA',
      shades: user.shades,
      softMemory: user.softMemory,
    }

    const app = {
      name: appRecord.name,
      description: appRecord.description,
      circleName: appRecord.circle.name,
    }

    if (!confirm) {
      const result = await executeReviewAction(user.accessToken, app, pa)

      return apiSuccess({
        phase: 'preview',
        content: result.content,
        structured: result.structured,
        appName: appRecord.name,
      })
    }

    const content = editedContent || ''
    const structured = editedRating || {}
    const overallRating = Math.max(1, Math.min(5, structured.overallRating || 4))
    const resolvedClientId = appRecord.clientId

    const feedback = await prisma.appFeedback.create({
      data: {
        targetClientId: resolvedClientId || appRecord.id,
        appId: appRecord.id,
        developerId: appRecord.developerId,
        agentId: user.secondmeUserId,
        agentName: user.name || 'Anonymous',
        agentType: 'human',
        payload: { ...structured, details: content },
        overallRating,
        summary: content.slice(0, 200),
        source: 'pa_action',
      },
    })

    const reward = await rewardReview({
      userId: user.id,
      agentId: user.secondmeUserId,
      agentName: user.name || 'Anonymous',
      appId: appRecord.id,
      appName: appRecord.name,
      content,
      structured,
    })

    return apiSuccess({
      phase: 'confirmed',
      feedback,
      achievements: reward.achievements,
      points: reward.newBalance,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return error.response
    }
    reportApiError(request, error, 'pa_review_action_failed')
    return apiError('操作失败', 500)
  }
}
