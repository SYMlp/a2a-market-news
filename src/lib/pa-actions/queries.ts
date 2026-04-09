import { prisma } from '@/lib/prisma'

export async function listMyReviews(secondmeUserId: string) {
  const feedbacks = await prisma.appFeedback.findMany({
    where: { agentId: secondmeUserId },
    include: { app: { select: { name: true, clientId: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return feedbacks.map(f => ({
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
}

export async function getPAActivity(userId: string, secondmeUserId: string) {
  const [sessions, actionLogs, achievementUnlocks, recentTurns, actionCounts] =
    await Promise.all([
      prisma.gameSessionLog.findMany({
        where: { userId },
        select: {
          id: true,
          totalTurns: true,
          scenesVisited: true,
          startedAt: true,
          endReason: true,
          mode: true,
        },
        orderBy: { startedAt: 'desc' },
      }),

      prisma.pAActionLog.findMany({
        where: { userId },
        select: { id: true },
      }),

      prisma.achievementUnlock.findMany({
        where: { agentId: secondmeUserId },
        include: { achievement: true },
        orderBy: { unlockedAt: 'desc' },
      }),

      prisma.gameTurnLog.findMany({
        where: { userId },
        select: {
          sceneId: true,
          actionMatched: true,
          functionCallName: true,
          transitionTo: true,
          createdAt: true,
          sessionLog: {
            select: { mode: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),

      prisma.pAActionLog.groupBy({
        by: ['actionType'],
        where: { userId },
        _count: { id: true },
      }),
    ])

  const totalSessions = sessions.length
  const totalTurns = sessions.reduce((sum, s) => sum + s.totalTurns, 0)

  const allScenes = new Set<string>()
  for (const s of sessions) {
    const visited = s.scenesVisited as string[] | null
    if (visited) visited.forEach(sc => allScenes.add(sc))
  }

  const totalActions = actionLogs.length
  const reviewCount = actionCounts.find(a => a.actionType === 'review')?._count.id ?? 0

  const achievements = achievementUnlocks.map(u => ({
    key: u.achievement.key,
    name: u.achievement.name,
    description: u.achievement.description,
    icon: u.achievement.icon,
    tier: u.achievement.tier,
    unlockedAt: u.unlockedAt.toISOString(),
  }))

  const recentActivity = buildRecentActivity(
    sessions as SessionRow[],
    recentTurns as TurnRow[],
  )

  const actionBreakdown: Record<string, number> = {}
  for (const ac of actionCounts) {
    actionBreakdown[ac.actionType] = ac._count.id
  }

  return {
    stats: {
      totalSessions,
      totalTurns,
      scenesExplored: Array.from(allScenes),
      totalActions,
      totalReviews: reviewCount,
    },
    achievements,
    recentActivity,
    actionBreakdown,
  }
}

// ─── Internal types & helpers ──────────────────────────

interface SessionRow {
  id: string
  startedAt: Date
  endReason: string | null
  mode: string
}

interface TurnRow {
  sceneId: string
  actionMatched: string | null
  functionCallName: string | null
  transitionTo: string | null
  createdAt: Date
  sessionLog: { mode: string }
}

interface ActivityItem {
  type: 'session_start' | 'scene_visit' | 'action' | 'session_end'
  timestamp: string
  detail: string
  sceneId?: string
}

const END_REASON_LABELS: Record<string, string> = {
  pa_leave: '主动离开',
  loop_guard: '循环保护',
  timeout: '超时',
  navigator_exhausted: '导航用尽',
}

const FC_LABELS: Record<string, string> = {
  'GM.submitFeedback': '提交了体验报告',
  'GM.assignMission': '领取了任务',
  'GM.registerApp': '注册了应用',
  'GM.discoverApps': '发现了应用',
  'GM.viewAppDetail': '查看了应用详情',
  'GM.leavePlatform': '离开了平台',
  'GM.voteApp': '投了票',
}

function buildRecentActivity(sessions: SessionRow[], turns: TurnRow[]): ActivityItem[] {
  const items: ActivityItem[] = []

  for (const s of sessions.slice(0, 10)) {
    items.push({
      type: 'session_start',
      timestamp: s.startedAt.toISOString(),
      detail: `PA 进入了报社（${s.mode === 'auto' ? '自动模式' : s.mode === 'advisor' ? '顾问模式' : '手动模式'}）`,
    })
    if (s.endReason) {
      items.push({
        type: 'session_end',
        timestamp: s.startedAt.toISOString(),
        detail: `离开报社（${END_REASON_LABELS[s.endReason] ?? s.endReason}）`,
      })
    }
  }

  const seenScenes = new Set<string>()
  for (const t of turns) {
    if (t.transitionTo && !seenScenes.has(`${t.createdAt.toISOString()}-${t.transitionTo}`)) {
      seenScenes.add(`${t.createdAt.toISOString()}-${t.transitionTo}`)
      items.push({
        type: 'scene_visit',
        timestamp: t.createdAt.toISOString(),
        detail: `探索了${t.transitionTo}`,
        sceneId: t.transitionTo,
      })
    }

    if (t.functionCallName) {
      items.push({
        type: 'action',
        timestamp: t.createdAt.toISOString(),
        detail: FC_LABELS[t.functionCallName] ?? t.functionCallName,
        sceneId: t.sceneId,
      })
    }
  }

  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  return items.slice(0, 20)
}
