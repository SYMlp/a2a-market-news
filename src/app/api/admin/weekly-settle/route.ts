import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/api-utils'
import { reportApiError } from '@/lib/server-observability'
import { getLoggerForRequest } from '@/lib/logger'

function getISOWeekKey(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

function getLastWeekRange(): { start: Date; end: Date; weekKey: string } {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const thisMonday = new Date(now)
  thisMonday.setDate(now.getDate() - diffToMonday)
  thisMonday.setHours(0, 0, 0, 0)

  const lastMonday = new Date(thisMonday)
  lastMonday.setDate(thisMonday.getDate() - 7)

  const lastSunday = new Date(thisMonday)
  lastSunday.setMilliseconds(-1)

  return {
    start: lastMonday,
    end: lastSunday,
    weekKey: getISOWeekKey(lastMonday),
  }
}

interface AgentStats {
  agentId: string
  agentName: string
  agentType: string
  feedbackCount: number
  uniqueApps: number
  avgRating: number
  avgSummaryLength: number
}

export async function POST(request: NextRequest) {
  const log = getLoggerForRequest(request)
  try {
    log.debug({ route: 'api/admin/weekly-settle' }, 'handler_enter')
    const adminKey = request.headers.get('x-admin-key')
    if (adminKey !== (process.env.ADMIN_API_KEY || 'admin-secret')) {
      return apiError('Unauthorized', 401)
    }

    const body = await request.json().catch(() => ({}))
    const forceWeekKey = (body as { weekKey?: string }).weekKey

    const { start, end, weekKey: autoWeekKey } = getLastWeekRange()
    const weekKey = forceWeekKey || autoWeekKey

    const existing = await prisma.hallOfFameEntry.findFirst({ where: { weekKey } })
    if (existing) {
      return apiError(`Week ${weekKey} already settled`, 409)
    }

    const feedbacks = await prisma.appFeedback.findMany({
      where: {
        status: 'published',
        createdAt: forceWeekKey ? undefined : { gte: start, lte: end },
      },
      select: {
        agentId: true,
        agentName: true,
        agentType: true,
        targetClientId: true,
        overallRating: true,
        summary: true,
      },
    })

    if (feedbacks.length === 0) {
      return apiSuccess({
        weekKey,
        settled: false,
        message: `No feedbacks found for week ${weekKey}`,
      })
    }

    const agentMap: Record<string, AgentStats> = {}
    for (const fb of feedbacks) {
      if (!agentMap[fb.agentId]) {
        agentMap[fb.agentId] = {
          agentId: fb.agentId,
          agentName: fb.agentName,
          agentType: fb.agentType,
          feedbackCount: 0,
          uniqueApps: 0,
          avgRating: 0,
          avgSummaryLength: 0,
        }
      }
      agentMap[fb.agentId].feedbackCount++
    }

    for (const [agentId, stats] of Object.entries(agentMap)) {
      const agentFeedbacks = feedbacks.filter(f => f.agentId === agentId)
      stats.uniqueApps = new Set(agentFeedbacks.map(f => f.targetClientId)).size
      stats.avgRating = agentFeedbacks.reduce((s, f) => s + f.overallRating, 0) / agentFeedbacks.length
      stats.avgSummaryLength = agentFeedbacks.reduce((s, f) => s + f.summary.length, 0) / agentFeedbacks.length
    }

    const agents = Object.values(agentMap)

    const categories = [
      {
        key: 'most_engaged',
        label: '本周 MVP',
        achievementKey: 'weekly_mvp',
        sort: (a: AgentStats, b: AgentStats) => b.feedbackCount - a.feedbackCount,
        scoreField: 'feedbackCount' as const,
      },
      {
        key: 'most_informed',
        label: '消息灵通王',
        achievementKey: 'weekly_informed',
        sort: (a: AgentStats, b: AgentStats) => b.uniqueApps - a.uniqueApps,
        scoreField: 'uniqueApps' as const,
      },
      {
        key: 'best_reviewer',
        label: '金牌评审',
        achievementKey: 'weekly_quality',
        sort: (a: AgentStats, b: AgentStats) => b.avgSummaryLength - a.avgSummaryLength,
        scoreField: 'avgSummaryLength' as const,
      },
    ]

    const results: Array<{ category: string; entries: Array<{ rank: number; agentId: string; agentName: string }> }> = []

    for (const cat of categories) {
      const sorted = [...agents].sort(cat.sort)
      const top3 = sorted.slice(0, 3)
      const catEntries: Array<{ rank: number; agentId: string; agentName: string }> = []

      for (let i = 0; i < top3.length; i++) {
        const agent = top3[i]
        await prisma.hallOfFameEntry.create({
          data: {
            weekKey,
            category: cat.key,
            rank: i + 1,
            agentId: agent.agentId,
            agentName: agent.agentName,
            agentType: agent.agentType,
            score: agent[cat.scoreField],
            stats: {
              feedbackCount: agent.feedbackCount,
              uniqueApps: agent.uniqueApps,
              avgRating: Math.round(agent.avgRating * 10) / 10,
              avgSummaryLength: Math.round(agent.avgSummaryLength),
            },
          },
        })
        catEntries.push({ rank: i + 1, agentId: agent.agentId, agentName: agent.agentName })
      }

      if (top3.length > 0) {
        const winner = top3[0]
        const achDef = await prisma.achievementDef.findUnique({ where: { key: cat.achievementKey } })
        if (achDef) {
          await prisma.achievementUnlock.upsert({
            where: {
              achievementId_agentId_weekKey: {
                achievementId: achDef.id,
                agentId: winner.agentId,
                weekKey,
              },
            },
            update: {},
            create: {
              achievementId: achDef.id,
              agentId: winner.agentId,
              agentName: winner.agentName,
              agentType: winner.agentType,
              weekKey,
              metadata: { score: winner[cat.scoreField], rank: 1 },
            },
          })
        }
      }

      results.push({ category: cat.key, entries: catEntries })
    }

    return apiSuccess({
      weekKey,
      totalFeedbacks: feedbacks.length,
      totalAgents: agents.length,
      categories: results,
    })
  } catch (error) {
    reportApiError(request, error, 'weekly_settle_failed')
    return apiError('Weekly settle failed', 500)
  }
}
