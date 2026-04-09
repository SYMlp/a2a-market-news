import { NextRequest } from 'next/server'
import { reportApiError } from '@/lib/server-observability'
import { getLoggerForRequest } from '@/lib/logger'
import { apiError, apiSuccess, AuthError, requireAuth } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { executeVoteAction, logPAAction } from '@/lib/pa-actions'
import { addPoints, incrementDailyTask } from '@/lib/gamification'

export async function POST(request: NextRequest) {
  const log = getLoggerForRequest(request)
  try {
    log.debug({ route: 'api/pa-action/vote' }, 'handler_enter')
    const user = await requireAuth()

    const { appId } = await request.json()
    if (!appId) {
      return apiError('缺少 appId', 400)
    }

    const appRecord = await prisma.app.findUnique({
      where: { id: appId },
    })

    if (!appRecord) {
      return apiError('应用不存在', 404)
    }

    const existing = await prisma.vote.findUnique({
      where: { userId_appId: { userId: user.id, appId } },
    })

    if (existing) {
      return apiError('你已经投过票了', 409)
    }

    const pa = { name: user.name || '匿名PA', shades: user.shades }
    const app = { name: appRecord.name, description: appRecord.description }

    const result = await executeVoteAction(user.accessToken, app, pa)
    const voteType = (result.structured?.vote as string) === 'down' ? 'down' : 'up'
    const reasoning = (result.structured?.reasoning as string) || result.content

    const vote = await prisma.vote.create({
      data: {
        userId: user.id,
        appId,
        voteType,
        reasoning,
        paGenerated: true,
      },
    })

    await prisma.app.update({
      where: { id: appId },
      data: {
        voteCount: { increment: voteType === 'up' ? 1 : -1 },
        score: { increment: voteType === 'up' ? 1 : -0.5 },
      },
    })

    const [points] = await Promise.all([
      addPoints(user.id, 'vote', `为 ${appRecord.name} 投票`),
      incrementDailyTask(user.id, 'vote'),
      logPAAction(user.id, 'vote', appId, `vote:${appRecord.name}`, reasoning, result.structured, 5),
    ])

    return apiSuccess({
      vote,
      reasoning,
      voteType,
      points: points.newBalance,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return error.response
    }
    reportApiError(request, error, 'pa_vote_action_failed')
    return apiError('投票失败', 500)
  }
}
