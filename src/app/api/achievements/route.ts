import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const defs = await prisma.achievementDef.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { unlocks: true } },
      },
    })

    return NextResponse.json({ success: true, data: defs })
  } catch (error) {
    console.error('Failed to fetch achievements:', error)
    return NextResponse.json({ error: 'Failed to fetch achievements' }, { status: 500 })
  }
}
