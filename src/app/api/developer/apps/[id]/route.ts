import { NextRequest } from 'next/server'
import { getDeveloperOwnedApp, updateDeveloperApp } from '@/lib/developer/apps'
import { apiError, apiSuccess, AuthError, requireAuth } from '@/lib/api-utils'
import { reportApiError } from '@/lib/server-observability'

/**
 * GET /api/developer/apps/[id]
 * Return single app details. Auth required, must own the app.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const result = await getDeveloperOwnedApp(id, user.id)
    if (result.status === 'not_found') {
      return apiError('App not found', 404)
    }
    if (result.status === 'forbidden') {
      return apiError('Forbidden', 403)
    }

    return apiSuccess(result.app)
  } catch (error) {
    if (error instanceof AuthError) {
      return error.response
    }
    reportApiError(_request, error, 'get_app_detail_failed')
    return apiError('Query failed', 500)
  }
}

/**
 * PUT /api/developer/apps/[id]
 * Update app fields: clientId, links, description, etc.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await request.json()

    const result = await updateDeveloperApp(id, user.id, body)
    if (!result.ok) {
      return apiError(result.error, result.status)
    }

    return apiSuccess(result.data)
  } catch (error) {
    if (error instanceof AuthError) {
      return error.response
    }
    reportApiError(request, error, 'update_app_failed')
    return apiError('Update failed', 500)
  }
}
