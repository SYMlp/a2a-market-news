import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/gm/developer-status
 * Returns developer's feedback status for the Developer Space.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    // Non-developers receive minimal data + guidance to register (no auto-promote)
    if (!user.isDeveloper) {
      return NextResponse.json({
        success: true,
        data: {
          isDeveloper: false,
          hasApps: false,
          feedback_status: '你还没有成为开发者。',
          feedback_hint: '可以前往开发者注册页面完成注册，或点击「我是开发者」进入注册流程。',
          feedback_summary: 'Not a developer.',
          apps_summary: '请先完成开发者注册。',
          apps_summary_brief: '请先完成开发者注册，即可管理你的应用。',
          apps_json: '[]',
          feedbacks: [],
        },
      })
    }

    const apps = await prisma.app.findMany({
      where: { developerId: user.id },
      select: { id: true, name: true, clientId: true, status: true },
    })

    if (apps.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          hasApps: false,
          feedback_status: '你还没有在平台上注册过应用。',
          feedback_hint: '可以注册一个新应用，让大家来体验和评价！',
          feedback_summary: 'No apps registered.',
          apps_summary: '你还没有注册任何应用。',
          apps_summary_brief: '你还没有注册任何应用，可以注册一个新应用！',
          apps_json: '[]',
          feedbacks: [],
        },
      })
    }

    const appIds = apps.map(a => a.id)
    const feedbacks = await prisma.appFeedback.findMany({
      where: { appId: { in: appIds } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        agentName: true,
        summary: true,
        overallRating: true,
        createdAt: true,
        appId: true,
      },
    })

    // Group feedbacks by app for per-app stats
    const feedbacksByApp = new Map<string, typeof feedbacks>()
    for (const f of feedbacks) {
      if (!f.appId) continue
      const list = feedbacksByApp.get(f.appId) || []
      list.push(f)
      feedbacksByApp.set(f.appId, list)
    }

    // Build per-app structured data
    const appsWithStats = apps.map(app => {
      const appFeedbacks = feedbacksByApp.get(app.id) || []
      const ratings = appFeedbacks.map(f => f.overallRating).filter(r => r > 0)
      const avgRating = ratings.length > 0
        ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length * 10) / 10
        : 0
      const latestFeedback = appFeedbacks[0] || null
      return {
        id: app.id,
        name: app.name,
        clientId: app.clientId,
        status: app.status,
        feedbackCount: appFeedbacks.length,
        avgRating,
        latestFeedback: latestFeedback
          ? { agent: latestFeedback.agentName, summary: latestFeedback.summary, rating: latestFeedback.overallRating }
          : null,
      }
    })

    const appsSummary = appsWithStats.map((app, i) => {
      const ratingStr = app.avgRating > 0 ? `${app.avgRating}★` : '暂无评分'
      return `${i + 1}. ${app.name}（${app.feedbackCount} 条反馈，${ratingStr}）`
    }).join('\n')

    const totalFeedbacks = feedbacks.length
    const appsSummaryBrief = `你有 ${apps.length} 个应用` + (
      totalFeedbacks > 0 ? `，最近收到 ${totalFeedbacks} 条反馈。` : '，暂无新反馈。'
    )

    const feedbackList = feedbacks.length > 0
      ? feedbacks.map((f, i) => {
          const app = apps.find(a => a.id === f.appId)
          return `${i + 1}. [${app?.name || '应用'}] ${f.agentName}: "${f.summary}" (${f.overallRating}/5)`
        }).join('\n')
      : '暂无反馈'

    const feedbackJson = JSON.stringify(
      feedbacks.map(f => ({
        id: f.id,
        agent: f.agentName,
        summary: f.summary,
        rating: f.overallRating,
        date: f.createdAt,
      }))
    )

    return NextResponse.json({
      success: true,
      data: {
        isDeveloper: true,
        hasApps: true,
        appCount: apps.length,
        feedbackCount: totalFeedbacks,
        feedback_status: totalFeedbacks > 0
          ? `你有 ${totalFeedbacks} 条用户建议！`
          : '目前没有新的用户建议。',
        feedback_hint: totalFeedbacks > 0
          ? '可以查看应用概况、查看用户建议，或者注册新应用。'
          : '等有用户体验后就能收到建议了，可以查看应用概况或注册新应用。',
        feedback_summary: `${apps.length} apps, ${totalFeedbacks} feedbacks.`,
        feedback_list: feedbackList,
        feedback_json: feedbackJson,
        apps_summary: appsSummary,
        apps_summary_brief: appsSummaryBrief,
        apps_json: JSON.stringify(appsWithStats),
        feedbacks,
      },
    })
  } catch (error) {
    console.error('GM developer-status error:', error)
    return NextResponse.json({ error: '获取状态失败' }, { status: 500 })
  }
}
