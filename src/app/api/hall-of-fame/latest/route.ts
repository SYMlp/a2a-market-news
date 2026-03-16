import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const latestEntry = await prisma.hallOfFameEntry.findFirst({
      orderBy: { weekKey: 'desc' },
      select: { weekKey: true },
    })

    if (!latestEntry) {
      return NextResponse.json({ success: true, data: null, message: 'No hall of fame entries yet' })
    }

    const entries = await prisma.hallOfFameEntry.findMany({
      where: { weekKey: latestEntry.weekKey },
      orderBy: [{ category: 'asc' }, { rank: 'asc' }],
    })

    return NextResponse.json({
      success: true,
      data: { weekKey: latestEntry.weekKey, entries },
    })
  } catch (error) {
    console.error('Failed to fetch latest hall of fame:', error)
    return NextResponse.json({ error: 'Failed to fetch latest hall of fame' }, { status: 500 })
  }
}
