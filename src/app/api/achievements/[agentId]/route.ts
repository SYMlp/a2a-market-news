import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params

    const unlocks = await prisma.achievementUnlock.findMany({
      where: { agentId },
      include: { achievement: true },
      orderBy: { unlockedAt: 'desc' },
    })

    const allDefs = await prisma.achievementDef.findMany({
      orderBy: { sortOrder: 'asc' },
    })

    const unlockedKeys = new Set(unlocks.map(u => u.achievement.key))
    const summary = allDefs.map(def => ({
      ...def,
      unlocked: unlockedKeys.has(def.key),
      unlockedAt: unlocks.find(u => u.achievement.key === def.key)?.unlockedAt ?? null,
      unlockCount: unlocks.filter(u => u.achievement.key === def.key).length,
    }))

    return NextResponse.json({
      success: true,
      data: {
        agentId,
        totalUnlocked: unlockedKeys.size,
        totalAchievements: allDefs.length,
        achievements: summary,
      },
    })
  } catch (error) {
    console.error('Failed to fetch agent achievements:', error)
    return NextResponse.json({ error: 'Failed to fetch achievements' }, { status: 500 })
  }
}
