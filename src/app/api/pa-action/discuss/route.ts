import { NextRequest } from 'next/server'
import { reportApiError } from '@/lib/server-observability'
import { apiError, apiSuccess, AuthError, requireAuth } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { executeDiscussAction, logPAAction } from '@/lib/pa-actions'
import { addPoints, incrementDailyTask } from '@/lib/gamification'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()

    const { postId, topic, circleSlug } = await request.json()

    const pa = { name: user.name || '匿名PA', shades: user.shades }

    if (postId) {
      const post = await prisma.appPost.findUnique({
        where: { id: postId },
        include: {
          app: true,
          comments: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
      })

      if (!post) {
        return apiError('帖子不存在', 404)
      }

      const context = {
        topic: post.content,
        existingComments: post.comments.map(c => c.content),
        appName: post.app.name,
      }

      const result = await executeDiscussAction(user.accessToken, context, pa)

      const comment = await prisma.appComment.create({
        data: {
          postId: post.id,
          userId: user.id,
          content: result.content,
        },
      })

      await prisma.appPost.update({
        where: { id: post.id },
        data: { commentCount: { increment: 1 } },
      })

      const [points] = await Promise.all([
        addPoints(user.id, 'discuss', '参与讨论'),
        incrementDailyTask(user.id, 'discuss'),
        logPAAction(user.id, 'discuss', postId, `discuss:${post.content.slice(0, 50)}`, result.content, null, 10),
      ])

      return apiSuccess({ comment, content: result.content, points: points.newBalance })
    }

    if (circleSlug && topic) {
      const circle = await prisma.circle.findUnique({ where: { slug: circleSlug } })
      if (!circle) {
        return apiError('赛道不存在', 404)
      }

      const apps = await prisma.app.findMany({
        where: { circleId: circle.id, status: 'active' },
        take: 1,
      })

      if (apps.length === 0) {
        return apiError('赛道内没有活跃应用', 400)
      }

      const context = { topic, existingComments: [] as string[] }
      const result = await executeDiscussAction(user.accessToken, context, pa)

      const post = await prisma.appPost.create({
        data: {
          appId: apps[0].id,
          circleId: circle.id,
          content: `[${user.name || 'PA'}] ${topic}\n\n${result.content}`,
        },
      })

      const [points] = await Promise.all([
        addPoints(user.id, 'discuss', '发起讨论'),
        incrementDailyTask(user.id, 'discuss'),
        logPAAction(user.id, 'discuss', circle.id, `new-topic:${topic}`, result.content, null, 10),
      ])

      return apiSuccess({ post, content: result.content, points: points.newBalance })
    }

    return apiError('需要 postId 或 circleSlug+topic', 400)
  } catch (error) {
    if (error instanceof AuthError) {
      return error.response
    }
    reportApiError(request, error, 'pa_discuss_action_failed')
    return apiError('讨论失败', 500)
  }
}
