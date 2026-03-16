import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const weekKey = searchParams.get('weekKey')

    const where = weekKey ? { weekKey } : {}

    const entries = await prisma.hallOfFameEntry.findMany({
      where,
      orderBy: [{ weekKey: 'desc' }, { category: 'asc' }, { rank: 'asc' }],
    })

    const grouped: Record<string, typeof entries> = {}
    for (const entry of entries) {
      if (!grouped[entry.weekKey]) grouped[entry.weekKey] = []
      grouped[entry.weekKey].push(entry)
    }

    const weeks = Object.entries(grouped)
      .map(([weekKey, entries]) => ({ weekKey, entries }))
      .sort((a, b) => b.weekKey.localeCompare(a.weekKey))

    return NextResponse.json({ success: true, data: weeks })
  } catch (error) {
    console.error('Failed to fetch hall of fame:', error)
    return NextResponse.json({ error: 'Failed to fetch hall of fame' }, { status: 500 })
  }
}
