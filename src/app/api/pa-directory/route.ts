import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50')))
    const search = searchParams.get('search')?.trim()
    const sort = searchParams.get('sort') ?? 'lastActive'

    const where: Record<string, unknown> = { status: 'active' }
    if (search) {
      where.agentName = { contains: search }
    }

    const orderBy = sort === 'feedbacks'
      ? { feedbackCount: 'desc' as const }
      : sort === 'newest'
        ? { firstVisitAt: 'desc' as const }
        : { lastActiveAt: 'desc' as const }

    const [visitors, total] = await Promise.all([
      prisma.pAVisitor.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.pAVisitor.count({ where }),
    ])

    const agentIds = visitors.map(v => v.agentId)
    const badges = await prisma.achievementUnlock.findMany({
      where: { agentId: { in: agentIds } },
      include: { achievement: { select: { key: true, icon: true, name: true, tier: true } } },
    })

    const badgeMap: Record<string, Array<{ key: string; icon: string; name: string; tier: string }>> = {}
    for (const b of badges) {
      if (!badgeMap[b.agentId]) badgeMap[b.agentId] = []
      const already = badgeMap[b.agentId].find(x => x.key === b.achievement.key)
      if (!already) {
        badgeMap[b.agentId].push(b.achievement)
      }
    }

    const data = visitors.map(v => ({
      ...v,
      badges: badgeMap[v.agentId] ?? [],
    }))

    return NextResponse.json({
      success: true,
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Failed to fetch PA directory:', error)
    return NextResponse.json({ error: 'Failed to fetch PA directory' }, { status: 500 })
  }
}
