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

    const { appPAId, appId, clientId, confirm, editedContent, editedRating } = await request.json()
    const lookupId = appId ?? appPAId

    if (!lookupId && !clientId) {
      return NextResponse.json({ error: '缺少 appId/appPAId 或 clientId' }, { status: 400 })
    }

    const appRecord = lookupId
      ? await prisma.app.findUnique({ where: { id: lookupId }, include: { circle: true, developer: true } })
      : await prisma.app.findUnique({ where: { clientId }, include: { circle: true, developer: true } })

    if (!appRecord) {
      return NextResponse.json({ error: '应用不存在' }, { status: 404 })
    }

    const pa = {
      name: user.name || '匿名PA',
      shades: user.shades,
      softMemory: user.softMemory,
    }

    const app = {
      name: appRecord.name,
      description: appRecord.description,
      circleName: appRecord.circle.name,
    }

    if (!confirm) {
      const result = await executeReviewAction(user.accessToken, app, pa)

      return NextResponse.json({
        success: true,
        phase: 'preview',
        data: {
          content: result.content,
          structured: result.structured,
          appName: appRecord.name,
        },
      })
    }

    const content = editedContent || ''
    const structured = editedRating || {}
    const overallRating = Math.max(1, Math.min(5, structured.overallRating || 4))
    const resolvedClientId = appRecord.clientId

    const feedback = await prisma.appFeedback.create({
      data: {
        targetClientId: resolvedClientId || appRecord.id,
        appId: appRecord.id,
        developerId: appRecord.developerId,
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
        clientId || appRecord.id
      ).catch(() => ({ newUnlocks: [] })),
      addPoints(user.id, 'review', `评价了 ${appRecord.name}`),
      incrementDailyTask(user.id, 'review'),
      logPAAction(user.id, 'review', appRecord.id, `review:${appRecord.name}`, content, structured, 20),
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
