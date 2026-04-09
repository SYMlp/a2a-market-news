import { prisma } from '@/lib/prisma'

export async function listAchievementDefs() {
  const defs = await prisma.achievementDef.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { unlocks: true } } },
  })
  return defs
}

export async function getAgentAchievements(agentId: string) {
  const unlocks = await prisma.achievementUnlock.findMany({
    where: { agentId },
    include: { achievement: true },
    orderBy: { unlockedAt: 'desc' },
  })
  const allDefs = await prisma.achievementDef.findMany({ orderBy: { sortOrder: 'asc' } })
  const unlockedKeys = new Set(unlocks.map((u) => u.achievement.key))
  const summary = allDefs.map((def) => ({
    ...def,
    unlocked: unlockedKeys.has(def.key),
    unlockedAt: unlocks.find((u) => u.achievement.key === def.key)?.unlockedAt ?? null,
    unlockCount: unlocks.filter((u) => u.achievement.key === def.key).length,
  }))
  return {
    agentId,
    totalUnlocked: unlockedKeys.size,
    totalAchievements: allDefs.length,
    achievements: summary,
  }
}

export async function listHallOfFame(weekKey?: string | null) {
  const where = weekKey ? { weekKey } : {}
  const entries = await prisma.hallOfFameEntry.findMany({
    where,
    orderBy: [{ weekKey: 'desc' }, { category: 'asc' }, { rank: 'asc' }],
  })
  const grouped: Record<string, typeof entries> = {}
  for (const entry of entries) {
    if (!grouped[entry.weekKey]) grouped[entry.weekKey] = []
    grouped[entry.weekKey].push(entry)
  }
  return Object.entries(grouped)
    .map(([wk, es]) => ({ weekKey: wk, entries: es }))
    .sort((a, b) => b.weekKey.localeCompare(a.weekKey))
}

export async function getLatestHallOfFame() {
  const latestEntry = await prisma.hallOfFameEntry.findFirst({
    orderBy: { weekKey: 'desc' },
    select: { weekKey: true },
  })
  if (!latestEntry) return null
  const entries = await prisma.hallOfFameEntry.findMany({
    where: { weekKey: latestEntry.weekKey },
    orderBy: [{ category: 'asc' }, { rank: 'asc' }],
  })
  return { weekKey: latestEntry.weekKey, entries }
}

export async function getOrCreateCurrentSeason() {
  const now = new Date()

  let season = await prisma.season.findFirst({
    where: { status: 'active' },
    orderBy: { startDate: 'desc' },
  })

  if (!season) {
    season = await prisma.season.findFirst({
      where: { startDate: { lte: now }, endDate: { gte: now } },
      orderBy: { startDate: 'desc' },
    })
  }

  if (!season) {
    const d = now.getDay()
    const diff = d === 0 ? 6 : d - 1
    const monday = new Date(now)
    monday.setDate(now.getDate() - diff)
    monday.setHours(0, 0, 0, 0)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)

    const themes = [
      { theme: '最有趣应用', description: '本周寻找最让人眼前一亮的 A2A 应用' },
      { theme: '最实用工具', description: '发现真正解决问题的 A2A 应用' },
      { theme: '最具创意', description: '寻找最具创新精神的 A2A 应用' },
      { theme: '最佳体验', description: '评选用户体验最好的 A2A 应用' },
    ]

    const weekNum = Math.ceil(
      (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 86400000)
    )
    const picked = themes[weekNum % themes.length]

    const weekKey = `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`

    season = await prisma.season.upsert({
      where: { weekKey },
      update: {},
      create: {
        weekKey,
        theme: picked.theme,
        description: picked.description,
        status: 'active',
        startDate: monday,
        endDate: sunday,
      },
    })
  }

  return season
}
