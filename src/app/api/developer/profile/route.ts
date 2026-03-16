import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/**
 * GET /api/developer/profile
 * Retrieve current developer profile and notification preferences
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 })
    }
    if (!user.isDeveloper) {
      return NextResponse.json({ error: 'Not a developer' }, { status: 403 })
    }

    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        developerName: true,
        callbackUrl: true,
        notifyPreference: true,
      },
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: profile })
  } catch (error) {
    console.error('Profile fetch failed:', error)
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 })
  }
}

/**
 * PUT /api/developer/profile
 * Update developer profile and notification preferences
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 })
    }
    if (!user.isDeveloper) {
      return NextResponse.json({ error: 'Not a developer' }, { status: 403 })
    }

    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (body.developerName !== undefined) {
      data.developerName = body.developerName?.trim() || null
    }
    if (body.callbackUrl !== undefined) {
      data.callbackUrl = body.callbackUrl?.trim() || null
    }
    if (body.notifyPreference !== undefined) {
      const validPrefs = ['none', 'callback', 'in_app', 'both']
      if (validPrefs.includes(body.notifyPreference)) {
        data.notifyPreference = body.notifyPreference
      }
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data,
    })

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        developerName: updated.developerName,
        callbackUrl: updated.callbackUrl,
        notifyPreference: updated.notifyPreference,
      },
    })
  } catch (error) {
    console.error('Profile update failed:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
