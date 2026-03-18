import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/**
 * GET /api/developer/apps
 * List apps owned by the current developer.
 * Query: includeArchived=true to include archived apps (default: exclude).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 })
    }
    if (!user.isDeveloper) {
      return NextResponse.json({ error: 'Not a developer' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const includeArchived = searchParams.get('includeArchived') === 'true'

    const where: { developerId: string; status?: { not: string } } = { developerId: user.id }
    if (!includeArchived) {
      where.status = { not: 'archived' }
    }

    const apps = await prisma.app.findMany({
      where,
      include: {
        circle: true,
        _count: { select: { feedbacks: true } },
        feedbacks: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            agentName: true,
            agentType: true,
            overallRating: true,
            summary: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const appIds = apps.map(a => a.id)
    const ratings = await prisma.appFeedback.groupBy({
      by: ['appId'],
      where: { appId: { in: appIds } },
      _avg: { overallRating: true },
    })
    const ratingMap = new Map(ratings.map(r => [r.appId, r._avg.overallRating ?? 0]))

    const enriched = apps.map(app => ({
      ...app,
      avgRating: Math.round((ratingMap.get(app.id) ?? 0) * 10) / 10,
      latestFeedback: app.feedbacks[0] ?? null,
      feedbacks: undefined,
    }))

    return NextResponse.json({ success: true, data: enriched })
  } catch (error) {
    console.error('List developer apps failed:', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }
}

/**
 * POST /api/developer/apps
 * Register a new A2A app as developer
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 })
    }
    if (!user.isDeveloper) {
      return NextResponse.json({ error: 'Not a developer' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, website, logo, circleType, clientId, persona, metadata, shortPrompt, detailedPrompt, systemSummary } = body

    if (!name || !description || !circleType) {
      return NextResponse.json(
        { error: 'Missing required fields: name, description, circleType' },
        { status: 400 }
      )
    }

    const circle = await prisma.circle.findUnique({ where: { type: circleType } })
    if (!circle) {
      return NextResponse.json({ error: `Circle not found: ${circleType}` }, { status: 404 })
    }

    const resolvedClientId = clientId || `app-${crypto.randomUUID().slice(0, 8)}`
    const existingClient = await prisma.app.findUnique({ where: { clientId: resolvedClientId } })
    if (existingClient) {
      return NextResponse.json({ error: 'Client ID already registered' }, { status: 409 })
    }

    const app = await prisma.app.create({
      data: {
        name,
        description,
        website,
        logo,
        circleId: circle.id,
        category: circleType,
        developerId: user.id,
        clientId: resolvedClientId,
        persona,
        metadata,
        shortPrompt,
        detailedPrompt,
        systemSummary,
        status: 'active',
      },
      include: { circle: true },
    })

    await prisma.appMetrics.create({
      data: { appId: app.id, date: new Date() },
    })

    return NextResponse.json({ success: true, data: app })
  } catch (error) {
    console.error('Developer app registration failed:', error)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
