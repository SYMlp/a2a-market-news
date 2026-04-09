import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { err, ok, type ServiceResult } from '@/lib/service-result'

export async function listDeveloperApps(
  developerId: string,
  includeArchived: boolean,
) {
  const where: { developerId: string; status?: { not: string } } = { developerId }
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

  return apps.map(app => ({
    ...app,
    avgRating: Math.round((ratingMap.get(app.id) ?? 0) * 10) / 10,
    latestFeedback: app.feedbacks[0] ?? null,
    feedbacks: undefined,
  }))
}

export type DeveloperAppCreateInput = {
  name: string
  description: string
  website?: string
  logo?: string
  circleType: string
  clientId?: string
  persona?: unknown
  metadata?: unknown
  shortPrompt?: string
  detailedPrompt?: string
  systemSummary?: string
}

type AppWithCircle = Prisma.AppGetPayload<{ include: { circle: true } }>

export async function createDeveloperApp(
  developerId: string,
  input: DeveloperAppCreateInput,
): Promise<ServiceResult<AppWithCircle>> {
  const {
    name,
    description,
    website,
    logo,
    circleType,
    clientId,
    persona,
    metadata,
    shortPrompt,
    detailedPrompt,
    systemSummary,
  } = input

  const circle = await prisma.circle.findUnique({ where: { type: circleType } })
  if (!circle) {
    return err(`未找到圈子类型: ${circleType}`, 404)
  }

  const resolvedClientId = clientId || `app-${crypto.randomUUID().slice(0, 8)}`
  const existingClient = await prisma.app.findUnique({ where: { clientId: resolvedClientId } })
  if (existingClient) {
    return err('Client ID 已被注册', 409)
  }

  const app = await prisma.app.create({
    data: {
      name,
      description,
      website,
      logo,
      circleId: circle.id,
      category: circleType,
      developerId,
      clientId: resolvedClientId,
      persona: persona !== undefined ? (persona as Prisma.InputJsonValue) : undefined,
      metadata: metadata !== undefined ? (metadata as Prisma.InputJsonValue) : undefined,
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

  return ok(app)
}

type AppDetail = Prisma.AppGetPayload<{
  include: { circle: true; _count: { select: { feedbacks: true } } }
}>

export type GetDeveloperOwnedAppResult =
  | { status: 'ok'; app: AppDetail }
  | { status: 'not_found' }
  | { status: 'forbidden' }

export async function getDeveloperOwnedApp(
  appId: string,
  developerId: string,
): Promise<GetDeveloperOwnedAppResult> {
  const app = await prisma.app.findUnique({
    where: { id: appId },
    include: {
      circle: true,
      _count: { select: { feedbacks: true } },
    },
  })
  if (!app) return { status: 'not_found' }
  if (app.developerId !== developerId) return { status: 'forbidden' }
  return { status: 'ok', app }
}

const VALID_STATUSES = ['active', 'inactive', 'archived'] as const
type AppStatus = (typeof VALID_STATUSES)[number]

export type DeveloperAppUpdateBody = {
  name?: unknown
  description?: unknown
  clientId?: unknown
  website?: unknown
  logo?: unknown
  metadata?: unknown
  shortPrompt?: unknown
  detailedPrompt?: unknown
  systemSummary?: unknown
  status?: unknown
}

export async function updateDeveloperApp(
  appId: string,
  developerId: string,
  body: DeveloperAppUpdateBody,
): Promise<ServiceResult<AppWithCircle>> {
  const app = await prisma.app.findUnique({ where: { id: appId } })
  if (!app) {
    return err('App not found', 404)
  }
  if (app.developerId !== developerId) {
    return err('Forbidden', 403)
  }

  const {
    name,
    description,
    clientId,
    website,
    logo,
    metadata,
    shortPrompt,
    detailedPrompt,
    systemSummary,
    status,
  } = body as Record<string, unknown>

  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status as AppStatus)) {
      return err(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`, 400)
    }
    if (status === 'archived' && app.status === 'archived') {
      return err('App is already archived', 400)
    }
    if (app.status === 'archived') {
      return err('Cannot change status of archived app', 400)
    }
  }

  if (clientId !== undefined && clientId !== app.clientId) {
    const isAutoGenerated = app.clientId?.startsWith('app-') ?? true
    if (!isAutoGenerated) {
      return err('Client ID 已绑定 SecondMe 平台，不可修改。如需变更请联系管理员。', 403)
    }
    if (clientId) {
      const existing = await prisma.app.findUnique({ where: { clientId: String(clientId) } })
      if (existing && existing.id !== appId) {
        return err('Client ID already in use', 409)
      }
    }
  }

  const data = {
    ...(name !== undefined && { name }),
    ...(description !== undefined && { description }),
    ...(clientId !== undefined && { clientId: clientId || null }),
    ...(website !== undefined && { website }),
    ...(logo !== undefined && { logo }),
    ...(metadata !== undefined && { metadata }),
    ...(shortPrompt !== undefined && { shortPrompt }),
    ...(detailedPrompt !== undefined && { detailedPrompt }),
    ...(systemSummary !== undefined && { systemSummary }),
    ...(status !== undefined && { status }),
  } as Prisma.AppUpdateInput

  const updated = await prisma.app.update({
    where: { id: appId },
    data,
    include: { circle: true },
  })

  return ok(updated)
}
