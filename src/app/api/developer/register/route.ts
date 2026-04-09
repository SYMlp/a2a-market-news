import { NextRequest } from 'next/server'
import { registerAsDeveloper } from '@/lib/developer/register'
import { apiError, apiSuccess, AuthError, requireAuth } from '@/lib/api-utils'
import { reportApiError } from '@/lib/server-observability'

/**
 * POST /api/developer/register
 * Register current user as a developer
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await request.json()

    const result = await registerAsDeveloper(user.id, body)

    if (!result.ok) {
      return apiError(result.message, result.status)
    }

    return apiSuccess(result.data)
  } catch (error) {
    if (error instanceof AuthError) {
      return error.response
    }
    reportApiError(request, error, 'developer_registration_failed')
    return apiError('Registration failed', 500)
  }
}
