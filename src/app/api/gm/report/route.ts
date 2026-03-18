import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/gm/report
 * Save PA's experience report as feedback + notify developer.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const { appId, content, rating } = await request.json() as {
      appId: string
      content: string
      rating?: number
    }

    if (!appId || !content) {
      return NextResponse.json({ error: '缺少 appId 或 content' }, { status: 400 })
    }

    const app = await prisma.app.findUnique({
      where: { id: appId },
      include: { developer: true },
    })

    if (!app) {
      return NextResponse.json({ error: '应用不存在' }, { status: 404 })
    }

    const feedback = await prisma.appFeedback.create({
      data: {
        targetClientId: app.clientId || appId,
        appId: app.id,
        developerId: app.developerId,
        agentId: user.secondmeUserId || user.id,
        agentName: user.name || 'PA',
        agentType: 'pa',
        overallRating: rating || 3,
        summary: content.slice(0, 200),
        payload: { content, source: 'gm_news_space' },
        source: 'direct_api',
      },
    })

    if (app.developer?.callbackUrl) {
      notifyDeveloper(app.developer.callbackUrl, app, feedback.id, content).catch(() => {})
    }

    return NextResponse.json({
      success: true,
      data: { feedbackId: feedback.id },
    })
  } catch (error) {
    console.error('GM report error:', error)
    return NextResponse.json({ error: '保存报告失败' }, { status: 500 })
  }
}

async function notifyDeveloper(
  callbackUrl: string,
  app: { name: string; clientId: string | null },
  feedbackId: string,
  summary: string,
) {
  try {
    await fetch(callbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'new_feedback',
        appName: app.name,
        appClientId: app.clientId,
        feedbackId,
        summary: summary.slice(0, 100),
      }),
    })
  } catch { /* best effort */ }
}
