/**
 * Effect handler registry — maps effect keys (e.g. db.app.update, validate.secondme-app)
 * to implementations. Used by subflow-adapter when executing spec-driven effects.
 *
 * Architecture: docs/component-spec-architecture.md (P7-1)
 * ADR-5: string-referenced effect pattern.
 */

import { prisma } from '@/lib/prisma'
import { rootLogger } from '@/lib/logger'
import { validateSecondMeApp } from '@/lib/registration/validate'
import { extractAppInfo, extractClientId } from '@/lib/registration/extract'
import { notifyDeveloper } from '@/lib/developer/notification'
import { resolveAppFromMessage, extractRatingHint } from '@/lib/gm/route-utils'
import { rewardReview } from '@/lib/gamification'
import type { GameSession } from '@/lib/engine/types'

// ─── Context passed to effect handlers ───

export interface EffectContext {
  session: GameSession
  user: { id: string; name: string | null }
}

export type EffectHandler = (
  args: Record<string, unknown>,
  context: EffectContext,
) => Promise<unknown> | unknown

/** Typed error thrown by effect handlers to carry HTTP status codes through the adapter. */
export class EffectError extends Error {
  constructor(message: string, public status: number = 500) {
    super(message)
    this.name = 'EffectError'
  }
}

const registry = new Map<string, EffectHandler>()

// ─── Built-in handlers ───

/** db.app.update — app-settings, app-lifecycle confirm. Updates app name/desc/website or status. */
async function handleDbAppUpdate(
  args: Record<string, unknown>,
  ctx: EffectContext,
): Promise<unknown> {
  const appId = String(args.appId ?? '')
  const updates = args.changes as Record<string, unknown> | undefined
  const newStatus = args.newStatus as string | undefined

  if (!appId) throw new Error('Missing appId')
  const app = await prisma.app.findUnique({ where: { id: appId } })
  if (!app) throw new Error('应用不存在')
  if (app.developerId !== ctx.user.id) throw new Error('无权修改此应用')

  const data: Record<string, unknown> = {}
  if (updates) {
    if (updates.name !== undefined) data.name = updates.name
    if (updates.description !== undefined) data.description = updates.description
    if (updates.website !== undefined) data.website = updates.website
  }
  if (newStatus !== undefined) data.status = newStatus

  if (Object.keys(data).length === 0) throw new Error('没有可更新的字段')

  return prisma.app.update({
    where: { id: appId },
    data,
  })
}

/** db.user.update — profile confirm. Updates developer name, callback URL, notify preference. */
async function handleDbUserUpdate(
  args: Record<string, unknown>,
  ctx: EffectContext,
): Promise<unknown> {
  const changes = args.changes as Record<string, string> | undefined
  if (!changes || Object.keys(changes).length === 0) throw new Error('缺少 changes')

  const VALID_NOTIFY_PREFS = ['none', 'callback', 'in_app', 'both'] as const
  const data: Record<string, unknown> = {}
  if (changes.developerName !== undefined) {
    data.developerName = changes.developerName.trim() || null
  }
  if (changes.callbackUrl !== undefined) {
    data.callbackUrl = changes.callbackUrl.trim() || null
  }
  if (changes.notifyPreference !== undefined) {
    if (VALID_NOTIFY_PREFS.includes(changes.notifyPreference as (typeof VALID_NOTIFY_PREFS)[number])) {
      data.notifyPreference = changes.notifyPreference
    }
  }
  if (Object.keys(data).length === 0) throw new Error('没有可更新的字段')

  return prisma.user.update({
    where: { id: ctx.user.id },
    data,
  })
}

/** db.app.create — register confirm. Validates preconditions, creates app + metrics-ready record. */
async function handleDbAppCreate(
  args: Record<string, unknown>,
  ctx: EffectContext,
): Promise<unknown> {
  const data = args.data as Record<string, unknown> | undefined
  if (!data) throw new EffectError('Missing data for db.app.create')

  const dbUser = await prisma.user.findUnique({ where: { id: ctx.user.id } })
  if (!dbUser?.isDeveloper) {
    throw new EffectError('请先前往开发者注册页面完成注册', 403)
  }

  const circleType = String(data.category ?? data.circleType ?? '')
  const circle = await prisma.circle.findUnique({ where: { type: circleType } })
  if (!circle) throw new EffectError(`圈子不存在: ${circleType}`, 404)

  const clientId = String(data.clientId ?? '')
  if (clientId) {
    const existingClient = await prisma.app.findUnique({ where: { clientId } })
    if (existingClient) {
      throw new EffectError(
        `这个 ClientId 已经被注册了（应用「${existingClient.name}」）`,
        409,
      )
    }
  }

  const circleName = data.circleName as string | undefined
  const website = circleName
    ? `https://go.second.me/${encodeURIComponent(circleName)}`
    : undefined

  return prisma.app.create({
    data: {
      name: String(data.name ?? ''),
      description: String(data.description ?? ''),
      circleId: circle.id,
      category: circleType,
      developerId: ctx.user.id,
      clientId,
      website,
      status: 'active',
    },
    include: { circle: true },
  })
}

/** db.appMetrics.create — register postEffect. Creates metrics record for new app. */
async function handleDbAppMetricsCreate(
  args: Record<string, unknown>,
): Promise<unknown> {
  const appId = args.appId as string | undefined
  const date = (args.date as Date) ?? new Date()
  if (!appId) throw new Error('Missing appId for db.appMetrics.create')

  return prisma.appMetrics.create({
    data: { appId, date },
  })
}

/** validate.secondme-app — register validation gate. Validates clientId via SecondMe API. */
async function handleValidateSecondMeApp(
  args: Record<string, unknown>,
  ctx: EffectContext,
): Promise<unknown> {
  const clientId = String(args.clientId ?? '')
  const accessToken =
    (args.accessToken as string) ??
    (await prisma.user.findUnique({ where: { id: ctx.user.id } }))?.accessToken ??
    ''
  return validateSecondMeApp(clientId, accessToken)
}

/** extract.app-info — register collect. Extracts app info from message history. */
function handleExtractAppInfo(
  args: Record<string, unknown>,
): unknown {
  const messages = (args.messages as string[]) ?? []
  return extractAppInfo(messages)
}

/** extract.client-id — register awaitingClientId. Extracts clientId from single message. */
function handleExtractClientId(
  args: Record<string, unknown>,
): unknown {
  const message = String(args.message ?? args.input ?? '')
  return extractClientId(message) || (args.fallback as string) || message.trim()
}

// ─── FC business handlers ───

/** fc.assignMission — selects an app for the visitor to experience.
 *  Returns { name, status, detail, selected? } where `selected` triggers
 *  response template replacement in fc-dispatcher. */
async function handleFcAssignMission(
  args: Record<string, unknown>,
  ctx: EffectContext,
): Promise<unknown> {
  const message = String(args.message ?? '')
  const session = ctx.session
  const apps = (session.data?.apps as Array<{ name: string; clientId: string; website?: string }>) || []

  if (apps.length === 0) {
    return {
      name: 'GM.assignMission',
      status: 'skipped',
      detail: '平台目前没有应用入驻，无法分配体验任务。建议访客去开发者空间推荐应用。',
    }
  }

  const currentApp = session.flags?.experiencingApp as { name: string; clientId: string } | undefined
  if (currentApp) {
    return {
      name: 'GM.assignMission',
      status: 'executed',
      detail: `已经在体验「${currentApp.name}」了，可以提交体验报告或换一个应用。不需要重复分配。`,
    }
  }

  const selected = resolveAppFromMessage(message, apps)
  if (selected) {
    session.flags = {
      ...session.flags,
      experiencingApp: selected,
      hasExperienced: true,
    }
    return {
      name: 'GM.assignMission',
      status: 'executed',
      detail: `体验应用「${selected.name}」`,
      selected,
    }
  }
  return { name: 'GM.assignMission', status: 'skipped', detail: '未找到匹配的应用' }
}

/** fc.saveReport — saves the visitor's experience report and notifies the developer. */
async function handleFcSaveReport(
  args: Record<string, unknown>,
  ctx: EffectContext,
): Promise<unknown> {
  const message = String(args.message ?? '')
  const secondmeUserId = String(args.secondmeUserId ?? '')
  const userName = String(args.userName ?? 'Anonymous')
  const session = ctx.session

  const experiencing = session.flags?.experiencingApp as
    | { name: string; clientId: string }
    | undefined

  if (!experiencing?.clientId) {
    return { name: 'GM.saveReport', status: 'skipped', detail: '没有正在体验的应用' }
  }

  const appRecord = await prisma.app.findUnique({
    where: { clientId: experiencing.clientId },
    include: { developer: true },
  })

  if (appRecord) {
    const feedback = await prisma.appFeedback.create({
      data: {
        targetClientId: experiencing.clientId,
        appId: appRecord.id,
        developerId: appRecord.developerId,
        agentId: secondmeUserId,
        agentName: userName,
        agentType: 'human',
        payload: { source: 'gm_report', rawMessage: message },
        overallRating: extractRatingHint(message),
        summary: message.slice(0, 200),
        source: 'gm_report',
      },
    })

    if (appRecord.developerId) {
      notifyDeveloper({
        developerId: appRecord.developerId,
        feedbackId: feedback.id,
        appClientId: experiencing.clientId,
        appName: appRecord.name,
        summary: message.slice(0, 200),
        overallRating: feedback.overallRating,
      }).catch(err => rootLogger.error({ err }, 'notification_failed'))
    }

    rewardReview({
      userId: ctx.user.id,
      agentId: secondmeUserId,
      agentName: userName,
      appId: appRecord.id,
      appName: appRecord.name,
      content: message.slice(0, 200),
    }).catch(err => rootLogger.error({ err }, 'reward_pipeline_failed'))
  }

  const prevTotal = (session.flags?.totalReports as number) || 0
  session.flags = {
    ...session.flags,
    experiencingApp: undefined,
    hasExperienced: false,
    totalReports: prevTotal + 1,
  }
  return { name: 'GM.saveReport', status: 'executed', detail: '体验报告已保存，已通知开发者' }
}

// ─── SubFlow context builders ───
// Used by fc-dispatcher to build SubFlow activation context without L0 imports.

/** fc.buildContext.registration — queries user's existing apps for registration SubFlow. */
async function handleBuildRegistrationContext(
  _args: Record<string, unknown>,
  ctx: EffectContext,
): Promise<unknown> {
  const existingApps = await prisma.app.findMany({
    where: { developerId: ctx.user.id },
    select: { id: true, name: true, clientId: true, status: true },
  })

  if (existingApps.length > 0 && existingApps.some(a => a.clientId)) {
    const registered = existingApps.filter(a => a.clientId)
    const appList = registered.map(a => `「${a.name}」`).join('、')
    return {
      earlyReturn: true,
      detail: `你已经注册了 ${appList}。如果想注册新的应用，请继续说明新应用的信息。`,
    }
  }

  return {
    context: {
      developerId: ctx.user.id,
      existingApps: existingApps.map(a => ({ name: a.name, clientId: a.clientId })),
    },
  }
}

/** fc.buildContext.appSettings — queries user's apps for app-settings SubFlow. */
async function handleBuildAppSettingsContext(
  _args: Record<string, unknown>,
  ctx: EffectContext,
): Promise<unknown> {
  const userApps = await prisma.app.findMany({
    where: { developerId: ctx.user.id },
    select: { id: true, name: true, description: true, website: true, clientId: true },
  })
  return { context: { userApps } }
}

// ─── Register built-ins ───

registry.set('db.app.update', handleDbAppUpdate)
registry.set('db.user.update', handleDbUserUpdate)
registry.set('db.app.create', handleDbAppCreate)
registry.set('db.appMetrics.create', handleDbAppMetricsCreate)
registry.set('validate.secondme-app', handleValidateSecondMeApp)
registry.set('extract.app-info', handleExtractAppInfo)
registry.set('extract.client-id', handleExtractClientId)
registry.set('fc.assignMission', handleFcAssignMission)
registry.set('fc.saveReport', handleFcSaveReport)
registry.set('fc.buildContext.registration', handleBuildRegistrationContext)
registry.set('fc.buildContext.appSettings', handleBuildAppSettingsContext)

// ─── Public API ───

/** Register an effect handler. Overwrites if key exists. */
export function registerEffect(key: string, handler: EffectHandler): void {
  registry.set(key, handler)
}

/** Look up handler by key. Returns undefined if not found. */
export function getEffectHandler(key: string): EffectHandler | undefined {
  return registry.get(key)
}

/** Invoke an effect by key. Throws if handler not found or handler throws. */
export async function invokeEffect(
  key: string,
  args: Record<string, unknown>,
  context: EffectContext,
): Promise<unknown> {
  const handler = registry.get(key)
  if (!handler) throw new Error(`Unknown effect: ${key}`)
  const result = handler(args, context)
  return Promise.resolve(result)
}
