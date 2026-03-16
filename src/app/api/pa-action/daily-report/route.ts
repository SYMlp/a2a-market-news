import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { executeDailyReportAction, logPAAction } from '@/lib/pa-engine'
import { addPoints } from '@/lib/points'

export async function POST() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayActions = await prisma.pAActionLog.findMany({
      where: {
        userId: user.id,
        createdAt: { gte: today },
      },
    })

    const reviews = todayActions.filter(a => a.actionType === 'review').length
    const votes = todayActions.filter(a => a.actionType === 'vote').length
    const discussions = todayActions.filter(a => a.actionType === 'discuss').length
    const appNames = [...new Set(
      todayActions
        .filter(a => a.targetId)
        .map(a => a.targetId!)
    )]

    const appDetails = appNames.length > 0
      ? await prisma.appPA.findMany({
          where: { id: { in: appNames } },
          select: { name: true },
        })
      : []

    const activities = {
      reviews,
      votes,
      discussions,
      apps: appDetails.map(a => a.name),
    }

    const pa = { name: user.name || '匿名PA', shades: user.shades }
    const result = await executeDailyReportAction(user.accessToken, activities, pa)

    const report = await prisma.marketReport.create({
      data: {
        title: `${user.name || 'PA'} 的日报 - ${new Date().toLocaleDateString('zh-CN')}`,
        content: result.content,
        summary: result.content.slice(0, 200),
        type: 'personal_daily',
        period: 'daily',
        stats: { reviews, votes, discussions },
        insights: { apps: activities.apps },
      },
    })

    const [points] = await Promise.all([
      addPoints(user.id, 'daily_report', '生成每日报告'),
      logPAAction(user.id, 'daily_report', null, 'daily-report', result.content, null, 10),
    ])

    return NextResponse.json({
      success: true,
      data: {
        report,
        content: result.content,
        activities,
        points: points.newBalance,
      },
    })
  } catch (error) {
    console.error('PA daily report failed:', error)
    return NextResponse.json({ error: '日报生成失败' }, { status: 500 })
  }
}
