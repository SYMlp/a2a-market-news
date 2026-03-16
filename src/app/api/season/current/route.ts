import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const now = new Date()

    let season = await prisma.season.findFirst({
      where: { status: 'active' },
      orderBy: { startDate: 'desc' },
    })

    if (!season) {
      season = await prisma.season.findFirst({
        where: { startDate: { lte: now }, endDate: { gte: now } },
        orderBy: { startDate: 'desc' },
      })
    }

    if (!season) {
      const d = now.getDay()
      const diff = d === 0 ? 6 : d - 1
      const monday = new Date(now)
      monday.setDate(now.getDate() - diff)
      monday.setHours(0, 0, 0, 0)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      sunday.setHours(23, 59, 59, 999)

      const themes = [
        { theme: '最有趣应用', description: '本周寻找最让人眼前一亮的 A2A 应用' },
        { theme: '最实用工具', description: '发现真正解决问题的 A2A 应用' },
        { theme: '最具创意', description: '寻找最具创新精神的 A2A 应用' },
        { theme: '最佳体验', description: '评选用户体验最好的 A2A 应用' },
      ]

      const weekNum = Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 86400000))
      const picked = themes[weekNum % themes.length]

      const weekKey = `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`

      season = await prisma.season.upsert({
        where: { weekKey },
        update: {},
        create: {
          weekKey,
          theme: picked.theme,
          description: picked.description,
          status: 'active',
          startDate: monday,
          endDate: sunday,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: season,
    })
  } catch (error) {
    console.error('Season query failed:', error)
    return NextResponse.json({ error: '查询失败' }, { status: 500 })
  }
}
