import { prisma } from '@/lib/prisma'

export async function listDeveloperFeedbacks(
  developerId: string,
  options: {
    appId: string | null
    clientId: string | null
    page: number
    limit: number
  },
) {
  const { appId, clientId, page, limit } = options

  const where: Record<string, unknown> = { developerId }
  if (appId) {
    where.appId = appId
  } else if (clientId) {
    where.targetClientId = clientId
  }

  const [feedbacks, total] = await Promise.all([
    prisma.appFeedback.findMany({
      where,
      include: { app: { select: { name: true, clientId: true, logo: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.appFeedback.count({ where }),
  ])

  return { feedbacks, total }
}

export type ReplyToFeedbackResult =
  | { status: 'ok'; feedback: Awaited<ReturnType<typeof prisma.appFeedback.update>> }
  | { status: 'not_found' }
  | { status: 'forbidden' }

export async function replyToDeveloperFeedback(
  feedbackId: string,
  developerId: string,
  reply: string,
): Promise<ReplyToFeedbackResult> {
  const feedback = await prisma.appFeedback.findUnique({
    where: { id: feedbackId },
    include: { app: { select: { developerId: true } } },
  })

  if (!feedback) {
    return { status: 'not_found' }
  }

  if (feedback.app?.developerId !== developerId && feedback.developerId !== developerId) {
    return { status: 'forbidden' }
  }

  const updated = await prisma.appFeedback.update({
    where: { id: feedbackId },
    data: {
      developerReply: reply.trim(),
      developerReplyAt: new Date(),
    },
  })

  return { status: 'ok', feedback: updated }
}
