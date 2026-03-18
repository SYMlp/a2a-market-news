import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/**
 * POST /api/developer/notifications/mark-read
 * Marks all in-app notifications as read for the current developer.
 */
export async function POST() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 })
    }
    if (!user.isDeveloper) {
      return NextResponse.json({ error: 'Not a developer' }, { status: 403 })
    }

    const result = await prisma.notificationLog.updateMany({
      where: {
        developerId: user.id,
        channel: 'in_app',
        status: 'sent',
      },
      data: {
        status: 'read',
      },
    })

    return NextResponse.json({
      success: true,
      data: { markedCount: result.count },
    })
  } catch (error) {
    console.error('Mark notifications read failed:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
