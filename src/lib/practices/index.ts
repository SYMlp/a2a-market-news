import { prisma } from '@/lib/prisma'
import { rootLogger } from '@/lib/logger'
import { err, ok, type ServiceResult } from '@/lib/service-result'

export const PAGE_SIZE = 12
export const VALID_CATEGORIES = ['practice', 'showcase', 'tip'] as const
export type PracticeCategory = (typeof VALID_CATEGORIES)[number]

export async function listPractices(params: {
  page: number
  tag: string | null
  category: string | null
  authorId: string | null
  viewerUserId: string | null
}): Promise<ServiceResult<{ practices: Awaited<ReturnType<typeof prisma.developerPractice.findMany>>; total: number }>> {
  try {
    const { page, tag, category, authorId, viewerUserId } = params
    const isOwnQuery = authorId && viewerUserId === authorId

    const where: Record<string, unknown> = isOwnQuery ? {} : { status: 'published' }
    if (category && VALID_CATEGORIES.includes(category as PracticeCategory)) {
      where.category = category
    }
    if (authorId) {
      where.authorId = authorId
    }
    if (tag) {
      where.tags = { array_contains: tag }
    }

    const [practices, total] = await Promise.all([
      prisma.developerPractice.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.developerPractice.count({ where }),
    ])

    return ok({ practices, total })
  } catch (e) {
    rootLogger.error({ err: e }, 'list_practices_failed')
    return err('Query failed', 500)
  }
}

export async function createPractice(
  user: { id: string; isDeveloper: boolean },
  body: Record<string, unknown>,
): Promise<ServiceResult<Awaited<ReturnType<typeof prisma.developerPractice.create>>>> {
  try {
    if (!user.isDeveloper) {
      return err('Not a developer', 403)
    }

    const { title, content, summary, category, tags, keySteps, applicableTo, status } = body

    if (!title || !content || !summary || !category || !Array.isArray(tags)) {
      return err(
        'Missing required fields: title, content, summary, category, tags (array)',
        400,
      )
    }
    if (!VALID_CATEGORIES.includes(category as PracticeCategory)) {
      return err(`Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`, 400)
    }

    const practice = await prisma.developerPractice.create({
      data: {
        authorId: user.id,
        title: title as string,
        content: content as string,
        summary: summary as string,
        category: category as PracticeCategory,
        tags: tags as string[],
        keySteps: keySteps ?? undefined,
        applicableTo: applicableTo ?? undefined,
        status: status === 'draft' ? 'draft' : 'published',
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    })

    return ok(practice)
  } catch (e) {
    rootLogger.error({ err: e }, 'create_practice_failed')
    return err('Creation failed', 500)
  }
}

export async function getPublishedPracticeById(
  id: string,
): Promise<ServiceResult<Awaited<ReturnType<typeof prisma.developerPractice.findUnique>>>> {
  try {
    const practice = await prisma.developerPractice.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    })

    if (!practice) {
      return err('Practice not found', 404)
    }

    if (practice.status !== 'published') {
      return err('Practice not found', 404)
    }

    await prisma.developerPractice.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    })

    return ok({ ...practice, viewCount: practice.viewCount + 1 })
  } catch (e) {
    rootLogger.error({ err: e }, 'get_practice_detail_failed')
    return err('Query failed', 500)
  }
}

export async function likePublishedPractice(
  id: string,
): Promise<ServiceResult<{ likeCount: number }>> {
  try {
    const practice = await prisma.developerPractice.findUnique({
      where: { id },
      select: { id: true, status: true },
    })

    if (!practice || practice.status !== 'published') {
      return err('Practice not found', 404)
    }

    const updated = await prisma.developerPractice.update({
      where: { id },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true },
    })

    return ok({ likeCount: updated.likeCount })
  } catch (e) {
    rootLogger.error({ err: e }, 'like_practice_failed')
    return err('Like failed', 500)
  }
}
