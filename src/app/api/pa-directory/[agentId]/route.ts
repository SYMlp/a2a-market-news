import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params

    const visitor = await prisma.pAVisitor.findUnique({
      where: { agentId },
      include: {
        questions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })

    if (!visitor) {
      return NextResponse.json({ error: 'PA not found' }, { status: 404 })
    }

    const [unlocks, recentFeedbacks, hallEntries] = await Promise.all([
      prisma.achievementUnlock.findMany({
        where: { agentId },
        include: { achievement: true },
        orderBy: { unlockedAt: 'desc' },
      }),
      prisma.appFeedback.findMany({
        where: { agentId, status: 'published' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          targetClientId: true,
          overallRating: true,
          summary: true,
          createdAt: true,
          app: { select: { name: true } },
        },
      }),
      prisma.hallOfFameEntry.findMany({
        where: { agentId },
        orderBy: { weekKey: 'desc' },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        ...visitor,
        achievements: unlocks.map(u => ({
          key: u.achievement.key,
          name: u.achievement.name,
          icon: u.achievement.icon,
          tier: u.achievement.tier,
          unlockedAt: u.unlockedAt,
          weekKey: u.weekKey,
        })),
        recentFeedbacks,
        hallOfFameAppearances: hallEntries,
      },
    })
  } catch (error) {
    console.error('Failed to fetch PA detail:', error)
    return NextResponse.json({ error: 'Failed to fetch PA detail' }, { status: 500 })
  }
}
