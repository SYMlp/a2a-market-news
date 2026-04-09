import { NextRequest } from 'next/server'
import { markInAppNotificationsRead } from '@/lib/developer/notification'
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
 * POST /api/developer/notifications/mark-read
 * Marks all in-app notifications as read for the current developer.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    requireDeveloper(user)

    const result = await markInAppNotificationsRead(user.id)

    return apiSuccess({ markedCount: result.count })
  } catch (error) {
    if (error instanceof AuthError) {
      return error.response
    }
    if (error instanceof ForbiddenError) {
      return error.response
    }
    reportApiError(request, error, 'mark_notifications_read_failed')
    return apiError('Failed', 500)
  }
}
