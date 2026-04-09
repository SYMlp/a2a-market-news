import { prisma } from '../prisma'

const POINTS_TABLE: Record<string, number> = {
  review: 20,
  vote: 5,
  discuss: 10,
  discover: 15,
  daily_report: 10,
  daily_task_bonus: 30,
  achievement_unlock: 50,
  season_reward: 100,
}

export async function addPoints(
  userId: string,
  source: string,
  description: string,
  amount?: number
): Promise<{ newBalance: number }> {
  const pts = amount ?? POINTS_TABLE[source] ?? 0
  if (pts <= 0) return { newBalance: 0 }

  await prisma.pointTransaction.create({
    data: { userId, amount: pts, source, description },
  })

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (user) {
    await prisma.pAVisitor.upsert({
      where: { agentId: user.secondmeUserId },
      update: { points: { increment: pts } },
      create: {
        agentId: user.secondmeUserId,
        agentName: user.name || 'Anonymous',
        agentType: 'human',
        points: pts,
      },
    })
  }

  const total = await prisma.pointTransaction.aggregate({
    where: { userId },
    _sum: { amount: true },
  })

  return { newBalance: total._sum.amount || 0 }
}

export const DAILY_TASKS = [
  { key: 'review', name: '评价达人', description: '评价 1 个应用', target: 1, points: 20, icon: '⭐' },
  { key: 'vote', name: '投票先锋', description: '为 3 个应用投票', target: 3, points: 15, icon: '🗳️' },
  { key: 'discuss', name: '话题参与', description: '参与 1 次讨论', target: 1, points: 10, icon: '💬' },
]

export async function getDailyTaskProgress(userId: string) {
  const today = new Date().toISOString().slice(0, 10)

  const records = await prisma.dailyTaskProgress.findMany({
    where: { userId, date: today },
  })

  const progressMap = new Map(records.map(p => [p.taskKey, p]))

  return DAILY_TASKS.map(task => {
    const record = progressMap.get(task.key)
    return {
      ...task,
      progress: record?.progress ?? 0,
      completed: (record?.progress ?? 0) >= task.target,
    }
  })
}

export async function incrementDailyTask(
  userId: string,
  taskKey: string
): Promise<{ completed: boolean; allDone: boolean }> {
  const today = new Date().toISOString().slice(0, 10)
  const task = DAILY_TASKS.find(t => t.key === taskKey)
  if (!task) return { completed: false, allDone: false }

  const record = await prisma.dailyTaskProgress.upsert({
    where: { userId_taskKey_date: { userId, taskKey, date: today } },
    update: { progress: { increment: 1 } },
    create: { userId, taskKey, date: today, progress: 1 },
  })

  const justCompleted = record.progress === task.target
  if (justCompleted) {
    await addPoints(userId, 'daily_task_bonus', `完成每日任务：${task.name}`, task.points)
  }

  const allProgress = await prisma.dailyTaskProgress.findMany({
    where: { userId, date: today },
  })
  const allDone = DAILY_TASKS.every(t => {
    const p = allProgress.find(r => r.taskKey === t.key)
    return p && p.progress >= t.target
  })

  if (allDone && justCompleted) {
    await addPoints(userId, 'daily_task_bonus', '完成所有每日任务额外奖励', 30)
  }

  return { completed: justCompleted, allDone }
}

export async function getPointsBalance(userId: string): Promise<number> {
  const total = await prisma.pointTransaction.aggregate({
    where: { userId },
    _sum: { amount: true },
  })
  return total._sum.amount || 0
}

export async function getPointsHistory(
  userId: string,
  page: number = 1,
  limit: number = 20
) {
  const [transactions, total] = await Promise.all([
    prisma.pointTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.pointTransaction.count({ where: { userId } }),
  ])

  return { transactions, total }
}
