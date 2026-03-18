import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { executeDiscussAction, logPAAction } from '@/lib/pa-engine'
import { addPoints, incrementDailyTask } from '@/lib/points'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

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
        return NextResponse.json({ error: '帖子不存在' }, { status: 404 })
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

      return NextResponse.json({
        success: true,
        data: { comment, content: result.content, points: points.newBalance },
      })
    }

    if (circleSlug && topic) {
      const circle = await prisma.circle.findUnique({ where: { slug: circleSlug } })
      if (!circle) {
        return NextResponse.json({ error: '赛道不存在' }, { status: 404 })
      }

      const apps = await prisma.app.findMany({
        where: { circleId: circle.id, status: 'active' },
        take: 1,
      })

      if (apps.length === 0) {
        return NextResponse.json({ error: '赛道内没有活跃应用' }, { status: 400 })
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

      return NextResponse.json({
        success: true,
        data: { post, content: result.content, points: points.newBalance },
      })
    }

    return NextResponse.json({ error: '需要 postId 或 circleSlug+topic' }, { status: 400 })
  } catch (error) {
    console.error('PA discuss action failed:', error)
    return NextResponse.json({ error: '讨论失败' }, { status: 500 })
  }
}
