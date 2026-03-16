import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/**
 * GET /api/developer/apps/[id]
 * Return single app details. Auth required, must own the app.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 })
    }

    const { id } = await params

    const app = await prisma.appPA.findUnique({
      where: { id },
      include: {
        circle: true,
        _count: { select: { feedbacks: true } },
      },
    })

    if (!app) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 })
    }

    if (app.developerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ success: true, data: app })
  } catch (error) {
    console.error('Get app detail failed:', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }
}

/**
 * PUT /api/developer/apps/[id]
 * Update app fields: clientId, links, description, etc.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 })
    }

    const { id } = await params

    const app = await prisma.appPA.findUnique({ where: { id } })
    if (!app) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 })
    }
    if (app.developerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      description,
      clientId,
      website,
      logo,
      metadata,
    } = body

    if (clientId && clientId !== app.clientId) {
      const existing = await prisma.appPA.findUnique({ where: { clientId } })
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: 'Client ID already in use' }, { status: 409 })
      }
    }

    const updated = await prisma.appPA.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(clientId !== undefined && { clientId: clientId || null }),
        ...(website !== undefined && { website }),
        ...(logo !== undefined && { logo }),
        ...(metadata !== undefined && { metadata }),
      },
      include: { circle: true },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Update app failed:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
