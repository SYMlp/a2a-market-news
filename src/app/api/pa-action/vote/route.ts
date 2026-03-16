import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { executeVoteAction, logPAAction } from '@/lib/pa-engine'
import { addPoints, incrementDailyTask } from '@/lib/points'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const { appId } = await request.json()
    if (!appId) {
      return NextResponse.json({ error: '缺少 appId' }, { status: 400 })
    }

    const a2aApp = await prisma.a2AApp.findUnique({
      where: { id: appId },
      include: { appPA: true },
    })

    if (!a2aApp) {
      return NextResponse.json({ error: '应用不存在' }, { status: 404 })
    }

    const existing = await prisma.vote.findUnique({
      where: { userId_appId: { userId: user.id, appId } },
    })

    if (existing) {
      return NextResponse.json({ error: '你已经投过票了' }, { status: 409 })
    }

    const pa = { name: user.name || '匿名PA', shades: user.shades }
    const app = { name: a2aApp.name, description: a2aApp.description }

    const result = await executeVoteAction(user.accessToken, app, pa)
    const voteType = (result.structured?.vote as string) === 'down' ? 'down' : 'up'
    const reasoning = (result.structured?.reasoning as string) || result.content

    const vote = await prisma.vote.create({
      data: {
        userId: user.id,
        appId,
        voteType,
        reasoning,
        paGenerated: true,
      },
    })

    await prisma.a2AApp.update({
      where: { id: appId },
      data: {
        voteCount: { increment: voteType === 'up' ? 1 : -1 },
        score: { increment: voteType === 'up' ? 1 : -0.5 },
      },
    })

    const [points] = await Promise.all([
      addPoints(user.id, 'vote', `为 ${a2aApp.name} 投票`),
      incrementDailyTask(user.id, 'vote'),
      logPAAction(user.id, 'vote', appId, `vote:${a2aApp.name}`, reasoning, result.structured, 5),
    ])

    return NextResponse.json({
      success: true,
      data: {
        vote,
        reasoning,
        voteType,
        points: points.newBalance,
      },
    })
  } catch (error) {
    console.error('PA vote action failed:', error)
    return NextResponse.json({ error: '投票失败' }, { status: 500 })
  }
}
