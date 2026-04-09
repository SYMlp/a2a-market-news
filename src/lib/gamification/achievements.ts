import { prisma } from '../prisma'

interface AchievementCheckResult {
  newUnlocks: Array<{
    key: string
    name: string
    icon: string
    tier: string
  }>
}

/**
 * Check and unlock achievements after a feedback submission.
 * Also upserts the PA into the visitor directory.
 */
export async function processAchievements(
  agentId: string,
  agentName: string,
  agentType: string,
  targetClientId: string
): Promise<AchievementCheckResult> {
  void targetClientId
  const newUnlocks: AchievementCheckResult['newUnlocks'] = []

  await prisma.pAVisitor.upsert({
    where: { agentId },
    update: {
      agentName,
      feedbackCount: { increment: 1 },
      lastActiveAt: new Date(),
    },
    create: {
      agentId,
      agentName,
      agentType,
      feedbackCount: 1,
      source: agentType === 'human' ? 'secondme' : 'direct',
    },
  })

  const totalFeedbacks = await prisma.appFeedback.count({
    where: { agentId, status: 'published' },
  })

  const feedbackDefs = await prisma.achievementDef.findMany({
    where: { category: 'feedback' },
    orderBy: { threshold: 'asc' },
  })

  for (const def of feedbackDefs) {
    if (totalFeedbacks >= def.threshold) {
      const existing = await prisma.achievementUnlock.findUnique({
        where: {
          achievementId_agentId_weekKey: {
            achievementId: def.id,
            agentId,
            weekKey: '',
          },
        },
      })
      if (!existing) {
        await prisma.achievementUnlock.create({
          data: {
            achievementId: def.id,
            agentId,
            agentName,
            agentType,
            weekKey: '',
            metadata: { feedbackCount: totalFeedbacks },
          },
        })
        newUnlocks.push({ key: def.key, name: def.name, icon: def.icon, tier: def.tier })
      }
    }
  }

  const distinctCircles = await prisma.appFeedback.findMany({
    where: { agentId, status: 'published' },
    select: { app: { select: { circleId: true } } },
    distinct: ['appId'],
  })
  const circleSet = new Set(distinctCircles.map(f => f.app?.circleId).filter(Boolean))

  const multiCircleDef = await prisma.achievementDef.findUnique({ where: { key: 'multi_circle' } })
  if (multiCircleDef && circleSet.size >= multiCircleDef.threshold) {
    const existing = await prisma.achievementUnlock.findUnique({
      where: {
        achievementId_agentId_weekKey: {
          achievementId: multiCircleDef.id,
          agentId,
          weekKey: '',
        },
      },
    })
    if (!existing) {
      await prisma.achievementUnlock.create({
        data: {
          achievementId: multiCircleDef.id,
          agentId,
          agentName,
          agentType,
          weekKey: '',
          metadata: { circleCount: circleSet.size },
        },
      })
      newUnlocks.push({
        key: multiCircleDef.key,
        name: multiCircleDef.name,
        icon: multiCircleDef.icon,
        tier: multiCircleDef.tier,
      })
    }
  }

  const fiveStarCount = await prisma.appFeedback.count({
    where: { agentId, overallRating: 5, status: 'published' },
  })
  const fiveStarDef = await prisma.achievementDef.findUnique({ where: { key: 'five_star_giver' } })
  if (fiveStarDef && fiveStarCount >= fiveStarDef.threshold) {
    const existing = await prisma.achievementUnlock.findUnique({
      where: {
        achievementId_agentId_weekKey: {
          achievementId: fiveStarDef.id,
          agentId,
          weekKey: '',
        },
      },
    })
    if (!existing) {
      await prisma.achievementUnlock.create({
        data: {
          achievementId: fiveStarDef.id,
          agentId,
          agentName,
          agentType,
          weekKey: '',
          metadata: { fiveStarCount },
        },
      })
      newUnlocks.push({
        key: fiveStarDef.key,
        name: fiveStarDef.name,
        icon: fiveStarDef.icon,
        tier: fiveStarDef.tier,
      })
    }
  }

  const lowRatingCount = await prisma.appFeedback.count({
    where: { agentId, overallRating: { lte: 2 }, status: 'published' },
  })
  const criticalDef = await prisma.achievementDef.findUnique({ where: { key: 'critical_eye' } })
  if (criticalDef && lowRatingCount >= criticalDef.threshold) {
    const existing = await prisma.achievementUnlock.findUnique({
      where: {
        achievementId_agentId_weekKey: {
          achievementId: criticalDef.id,
          agentId,
          weekKey: '',
        },
      },
    })
    if (!existing) {
      await prisma.achievementUnlock.create({
        data: {
          achievementId: criticalDef.id,
          agentId,
          agentName,
          agentType,
          weekKey: '',
          metadata: { lowRatingCount },
        },
      })
      newUnlocks.push({
        key: criticalDef.key,
        name: criticalDef.name,
        icon: criticalDef.icon,
        tier: criticalDef.tier,
      })
    }
  }

  return { newUnlocks }
}
