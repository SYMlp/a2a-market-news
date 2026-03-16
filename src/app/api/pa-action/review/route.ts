import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { executeReviewAction, logPAAction } from '@/lib/pa-engine'
import { processAchievements } from '@/lib/achievement'
import { addPoints, incrementDailyTask } from '@/lib/points'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const { appPAId, clientId, confirm, editedContent, editedRating } = await request.json()

    if (!appPAId && !clientId) {
      return NextResponse.json({ error: '缺少 appPAId 或 clientId' }, { status: 400 })
    }

    const appPA = appPAId
      ? await prisma.appPA.findUnique({ where: { id: appPAId }, include: { circle: true, developer: true } })
      : await prisma.appPA.findUnique({ where: { clientId }, include: { circle: true, developer: true } })

    if (!appPA) {
      return NextResponse.json({ error: '应用不存在' }, { status: 404 })
    }

    const pa = {
      name: user.name || '匿名PA',
      shades: user.shades,
      softMemory: user.softMemory,
    }

    const app = {
      name: appPA.name,
      description: appPA.description,
      circleName: appPA.circle.name,
    }

    if (!confirm) {
      const result = await executeReviewAction(user.accessToken, app, pa)

      return NextResponse.json({
        success: true,
        phase: 'preview',
        data: {
          content: result.content,
          structured: result.structured,
          appName: appPA.name,
        },
      })
    }

    const content = editedContent || ''
    const structured = editedRating || {}
    const overallRating = Math.max(1, Math.min(5, structured.overallRating || 4))
    const resolvedClientId = appPA.clientId

    const feedback = await prisma.appFeedback.create({
      data: {
        targetClientId: resolvedClientId || appPA.id,
        appPAId: appPA.id,
        developerId: appPA.developerId,
        agentId: user.secondmeUserId,
        agentName: user.name || 'Anonymous',
        agentType: 'human',
        payload: { ...structured, details: content },
        overallRating,
        summary: content.slice(0, 200),
        source: 'pa_action',
      },
    })

    const [achievements, points] = await Promise.all([
      processAchievements(
        user.secondmeUserId,
        user.name || 'Anonymous',
        'human',
        clientId || appPA.id
      ).catch(() => ({ newUnlocks: [] })),
      addPoints(user.id, 'review', `评价了 ${appPA.name}`),
      incrementDailyTask(user.id, 'review'),
      logPAAction(user.id, 'review', appPA.id, `review:${appPA.name}`, content, structured, 20),
    ])

    return NextResponse.json({
      success: true,
      phase: 'confirmed',
      data: {
        feedback,
        achievements: achievements.newUnlocks,
        points: points.newBalance,
      },
    })
  } catch (error) {
    console.error('PA review action failed:', error)
    return NextResponse.json({ error: '操作失败' }, { status: 500 })
  }
}
