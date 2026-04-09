import { NextRequest } from 'next/server'
import { getDeveloperProfile, updateDeveloperProfile } from '@/lib/developer/profile'
import {
  apiError,
  apiSuccess,
  AuthError,
  ForbiddenError,
  requireAuth,
  requireDeveloper,
} from '@/lib/api-utils'
import { reportApiError } from '@/lib/server-observability'

/**
 * GET /api/developer/profile
 * Retrieve current developer profile and notification preferences
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    requireDeveloper(user)

    const profile = await getDeveloperProfile(user.id)

    if (!profile) {
      return apiError('Profile not found', 404)
    }

    return apiSuccess(profile)
  } catch (error) {
    if (error instanceof AuthError) {
      return error.response
    }
    if (error instanceof ForbiddenError) {
      return error.response
    }
    reportApiError(request, error, 'profile_fetch_failed')
    return apiError('Fetch failed', 500)
  }
}

/**
 * PUT /api/developer/profile
 * Update developer profile and notification preferences
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth()
    requireDeveloper(user)

    const body = await request.json()
    const updated = await updateDeveloperProfile(user.id, body)

    return apiSuccess({
      id: updated.id,
      developerName: updated.developerName,
      callbackUrl: updated.callbackUrl,
      notifyPreference: updated.notifyPreference,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return error.response
    }
    if (error instanceof ForbiddenError) {
      return error.response
    }
    reportApiError(request, error, 'profile_update_failed')
    return apiError('Update failed', 500)
  }
}
