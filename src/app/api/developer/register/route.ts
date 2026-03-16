import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/**
 * POST /api/developer/register
 * Register current user as a developer
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 })
    }

    const body = await request.json()
    const { developerName, callbackUrl, notifyPreference } = body

    if (!developerName?.trim()) {
      return NextResponse.json(
        { error: 'developerName is required' },
        { status: 400 }
      )
    }

    const validPrefs = ['none', 'callback', 'in_app', 'both']
    const pref = validPrefs.includes(notifyPreference) ? notifyPreference : 'in_app'

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        isDeveloper: true,
        developerName: developerName.trim(),
        callbackUrl: callbackUrl?.trim() || null,
        notifyPreference: pref,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        isDeveloper: updated.isDeveloper,
        developerName: updated.developerName,
        callbackUrl: updated.callbackUrl,
        notifyPreference: updated.notifyPreference,
      },
    })
  } catch (error) {
    console.error('Developer registration failed:', error)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
