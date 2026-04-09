import { prisma } from '@/lib/prisma'
import { rootLogger } from '@/lib/logger'
import { err, ok, type ServiceResult } from '@/lib/service-result'

export async function listPADirectory(params: {
  page: number
  limit: number
  search: string | null
  sort: string
}): Promise<
  ServiceResult<{
    visitors: Array<
      Record<string, unknown> & {
        badges: Array<{ key: string; icon: string; name: string; tier: string }>
      }
    >
    pagination: { page: number; limit: number; total: number; totalPages: number }
  }>
> {
  try {
    const { page, limit, search, sort } = params

    const where: Record<string, unknown> = { status: 'active' }
    if (search) {
      where.agentName = { contains: search }
    }

    const orderBy =
      sort === 'feedbacks'
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

    const badgeMap: Record<
      string,
      Array<{ key: string; icon: string; name: string; tier: string }>
    > = {}
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

    return ok({
      visitors: data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (e) {
    rootLogger.error({ err: e }, 'fetch_pa_directory_failed')
    return err('Failed to fetch PA directory', 500)
  }
}

export async function getPADetail(agentId: string): Promise<ServiceResult<Record<string, unknown>>> {
  try {
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
      return err('PA not found', 404)
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

    return ok({
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
    })
  } catch (e) {
    rootLogger.error({ err: e }, 'fetch_pa_detail_failed')
    return err('Failed to fetch PA detail', 500)
  }
}

export async function listPAQuestions(agentId: string): Promise<ServiceResult<unknown[]>> {
  try {
    const visitor = await prisma.pAVisitor.findUnique({ where: { agentId } })
    if (!visitor) {
      return err('PA not found', 404)
    }

    const questions = await prisma.pAQuestion.findMany({
      where: { visitorId: visitor.id },
      orderBy: { createdAt: 'desc' },
    })

    return ok(questions)
  } catch (e) {
    rootLogger.error({ err: e }, 'fetch_pa_questions_failed')
    return err('Failed to fetch questions', 500)
  }
}

export async function createPAQuestion(
  agentId: string,
  body: { title?: unknown; content?: unknown; targetAppId?: unknown },
): Promise<ServiceResult<Awaited<ReturnType<typeof prisma.pAQuestion.create>>>> {
  try {
    const visitor = await prisma.pAVisitor.findUnique({ where: { agentId } })
    if (!visitor) {
      return err('PA not found', 404)
    }

    const { title, content, targetAppId } = body
    if (!title || !content) {
      return err('title and content are required', 400)
    }

    const question = await prisma.pAQuestion.create({
      data: {
        visitorId: visitor.id,
        title: title as string,
        content: content as string,
        targetAppId: (targetAppId ?? null) as string | null,
      },
    })

    return ok(question)
  } catch (e) {
    rootLogger.error({ err: e }, 'create_pa_question_failed')
    return err('Failed to create question', 500)
  }
}
