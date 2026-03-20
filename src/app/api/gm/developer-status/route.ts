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

    let isDeveloper = !!user.isDeveloper

    if (!isDeveloper) {
      const ownedAppCount = await prisma.app.count({ where: { developerId: user.id } })
      if (ownedAppCount > 0) {
        await prisma.user.update({ where: { id: user.id }, data: { isDeveloper: true } })
        isDeveloper = true
      }
    }

    const latestPractices = await prisma.developerPractice.findMany({
      where: { status: 'published' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        summary: true,
        tags: true,
        category: true,
        keySteps: true,
        applicableTo: true,
        viewCount: true,
        likeCount: true,
        createdAt: true,
        author: { select: { name: true, developerName: true } },
      },
    })

    const practicesSummary = latestPractices.length > 0
      ? latestPractices.map((p, i) =>
          `${i + 1}. ${p.title}（${p.category}，${p.viewCount} 浏览）— ${p.summary}`
        ).join('\n')
      : '暂无开发者实践分享。'

    const practicesJson = JSON.stringify(
      latestPractices.map(p => ({
        id: p.id,
        title: p.title,
        summary: p.summary,
        tags: p.tags,
        category: p.category,
        keySteps: p.keySteps,
        applicableTo: p.applicableTo,
        author: p.author.developerName || p.author.name || 'Anonymous',
        viewCount: p.viewCount,
        likeCount: p.likeCount,
        createdAt: p.createdAt,
      }))
    )

    if (!isDeveloper) {
      return NextResponse.json({
        success: true,
        data: {
          isDeveloper: false,
          hasApps: false,
          feedback_status: '你还没有成为开发者。',
          feedback_hint: '可以前往开发者注册页面完成注册，或点击「我是开发者」进入注册流程。',
          feedback_summary: 'Not a developer.',
          apps_summary: '请先完成开发者注册。',
          apps_summary_brief: '请先完成开发者认证，即可把应用推荐给日报。',
          apps_json: '[]',
          feedbacks: [],
          practices_count: 0,
          practices_summary: practicesSummary,
          practices_list: practicesSummary,
          practices_json: practicesJson,
        },
      })
    }

    const apps = await prisma.app.findMany({
      where: { developerId: user.id },
      select: { id: true, name: true, clientId: true, status: true, description: true, website: true },
    })

    const ownPracticesCount = await prisma.developerPractice.count({
      where: { authorId: user.id, status: 'published' },
    })

    if (apps.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          isDeveloper: true,
          hasApps: false,
          feedback_status: '你还没有在日报收录应用。',
          feedback_hint: '把你做好的应用推荐给日报，让大家来体验和评价！',
          feedback_summary: 'No apps submitted.',
          apps_summary: '你还没有推荐应用给日报。',
          apps_summary_brief: '你还没有推荐应用给日报，把你做的应用告诉我们吧！',
          apps_json: '[]',
          feedbacks: [],
          practices_count: ownPracticesCount,
          practices_summary: practicesSummary,
          practices_list: practicesSummary,
          practices_json: practicesJson,
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
        description: app.description,
        website: app.website,
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
          ? '可以查看应用概况、查看用户建议，或者推荐新应用给日报。'
          : '等有用户体验后就能收到建议了，可以查看应用概况或推荐新应用。',
        feedback_summary: `${apps.length} apps, ${totalFeedbacks} feedbacks.`,
        feedback_list: feedbackList,
        feedback_json: feedbackJson,
        apps_summary: appsSummary,
        apps_summary_brief: appsSummaryBrief,
        apps_json: JSON.stringify(appsWithStats),
        feedbacks,
        practices_count: ownPracticesCount,
        practices_summary: practicesSummary,
        practices_list: practicesSummary,
        practices_json: practicesJson,
      },
    })
  } catch (error) {
    console.error('GM developer-status error:', error)
    return NextResponse.json({ error: '获取状态失败' }, { status: 500 })
  }
}
