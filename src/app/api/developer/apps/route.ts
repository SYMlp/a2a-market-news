import { NextRequest } from 'next/server'
import {
  apiError,
  apiSuccess,
  AuthError,
  ForbiddenError,
  requireAuth,
  requireDeveloper,
} from '@/lib/api-utils'
import { createDeveloperApp, listDeveloperApps } from '@/lib/developer/apps'
import { parseJsonBody } from '@/lib/validators/parse-json-body'
import { developerAppPostSchema } from '@/lib/validators/schemas/developer-app-post'
import { reportApiError } from '@/lib/server-observability'
import { getLoggerForRequest } from '@/lib/logger'

/**
 * GET /api/developer/apps
 * List apps owned by the current developer.
 * Query: includeArchived=true to include archived apps (default: exclude).
 */
export async function GET(request: NextRequest) {
  const log = getLoggerForRequest(request)
  try {
    log.debug({ route: 'api/developer/apps', method: 'GET' }, 'handler_enter')
    const user = await requireAuth()
    requireDeveloper(user)

    const { searchParams } = new URL(request.url)
    const includeArchived = searchParams.get('includeArchived') === 'true'

    const enriched = await listDeveloperApps(user.id, includeArchived)

    return apiSuccess(enriched)
  } catch (error) {
    if (error instanceof AuthError) {
      return error.response
    }
    if (error instanceof ForbiddenError) {
      return error.response
    }
    reportApiError(request, error, 'list_developer_apps_failed')
    return apiError('查询失败', 500)
  }
}

/**
 * POST /api/developer/apps
 * Register a new A2A app as developer
 */
export async function POST(request: NextRequest) {
  const log = getLoggerForRequest(request)
  try {
    log.debug({ route: 'api/developer/apps', method: 'POST' }, 'handler_enter')
    const user = await requireAuth()
    requireDeveloper(user)

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return apiError('请求体不是有效的 JSON', 400)
    }

    const parsed = parseJsonBody<Record<string, unknown>>(body, developerAppPostSchema)
    if (!parsed.ok) {
      return apiError(parsed.message, 400)
    }

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
    } = parsed.data as {
      name: string
      description: string
      circleType: string
      website?: string
      logo?: string
      clientId?: string
      persona?: unknown
      metadata?: unknown
      shortPrompt?: string
      detailedPrompt?: string
      systemSummary?: string
    }

    const result = await createDeveloperApp(user.id, {
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
    })

    if (!result.ok) {
      return apiError(result.error, result.status)
    }

    return apiSuccess(result.data)
  } catch (error) {
    if (error instanceof AuthError) {
      return error.response
    }
    if (error instanceof ForbiddenError) {
      return error.response
    }
    reportApiError(request, error, 'developer_app_registration_failed')
    return apiError('注册失败', 500)
  }
}
