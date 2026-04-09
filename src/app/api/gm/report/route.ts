import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess, AuthError, requireAuth } from '@/lib/api-utils'
import { reportApiError } from '@/lib/server-observability'
import { getLoggerForRequest } from '@/lib/logger'

/**
 * POST /api/gm/report
 * Save PA's experience report as feedback + notify developer.
 */
export async function POST(request: NextRequest) {
  const log = getLoggerForRequest(request)
  try {
    log.debug({ route: 'api/gm/report' }, 'handler_enter')
    const user = await requireAuth()

    const { appId, content, rating } = await request.json() as {
      appId: string
      content: string
      rating?: number
    }

    if (!appId || !content) {
      return apiError('缺少 appId 或 content', 400)
    }

    const app = await prisma.app.findUnique({
      where: { id: appId },
      include: { developer: true },
    })

    if (!app) {
      return apiError('应用不存在', 404)
    }

    const feedback = await prisma.appFeedback.create({
      data: {
        targetClientId: app.clientId || appId,
        appId: app.id,
        developerId: app.developerId,
        agentId: user.secondmeUserId || user.id,
        agentName: user.name || 'PA',
        agentType: 'pa',
        overallRating: rating || 3,
        summary: content.slice(0, 200),
        payload: { content, source: 'gm_news_space' },
        source: 'direct_api',
      },
    })

    if (app.developer?.callbackUrl) {
      notifyDeveloper(app.developer.callbackUrl, app, feedback.id, content).catch(() => {})
    }

    return apiSuccess({ feedbackId: feedback.id })
  } catch (error) {
    if (error instanceof AuthError) {
      return error.response
    }
    reportApiError(request, error, 'gm_report_error')
    return apiError('保存报告失败', 500)
  }
}

async function notifyDeveloper(
  callbackUrl: string,
  app: { name: string; clientId: string | null },
  feedbackId: string,
  summary: string,
) {
  try {
    await fetch(callbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'new_feedback',
        appName: app.name,
        appClientId: app.clientId,
        feedbackId,
        summary: summary.slice(0, 100),
      }),
    })
  } catch { /* best effort */ }
}
