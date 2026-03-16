import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/gm/recommend
 * Returns top apps for the News Space, formatted for GM scene data.
 */
export async function GET() {
  try {
    const apps = await prisma.appPA.findMany({
      where: { status: 'active' },
      include: {
        circle: { select: { name: true, type: true } },
        metrics: {
          orderBy: { date: 'desc' },
          take: 1,
        },
        _count: { select: { feedbacks: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    const formatted = apps.map((app, i) => ({
      index: i + 1,
      id: app.id,
      name: app.name,
      description: app.description,
      website: app.website,
      clientId: app.clientId,
      circle: app.circle?.name || '',
      circleType: app.circle?.type || '',
      feedbackCount: app._count.feedbacks,
      rating: app.metrics[0]?.rating ?? 0,
    }))

    const appsList = formatted
      .map(a => `${a.index}. ${a.name} — ${a.description}`)
      .join('\n')

    const appsJson = JSON.stringify(
      formatted.map(a => ({
        name: a.name,
        clientId: a.clientId,
        description: a.description,
        rating: a.rating,
        website: a.website,
      }))
    )

    return NextResponse.json({
      success: true,
      data: {
        apps: formatted,
        apps_list: appsList || '暂时还没有注册的应用，你可以回大厅去开发者空间注册第一个！',
        apps_json: appsJson,
      },
    })
  } catch (error) {
    console.error('GM recommend error:', error)
    return NextResponse.json({ error: '获取推荐失败' }, { status: 500 })
  }
}
