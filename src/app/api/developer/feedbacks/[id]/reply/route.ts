import { NextRequest } from 'next/server'
import { replyToDeveloperFeedback } from '@/lib/developer/feedbacks'
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
 * POST /api/developer/feedbacks/[id]/reply
 * Developer replies to a feedback on their app.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth()
    requireDeveloper(user)

    const { id } = await params

    const body = await request.json()
    const { reply } = body as { reply?: string }

    if (!reply?.trim()) {
      return apiError('Reply cannot be empty', 400)
    }

    const result = await replyToDeveloperFeedback(id, user.id, reply)

    if (result.status === 'not_found') {
      return apiError('Feedback not found', 404)
    }
    if (result.status === 'forbidden') {
      return apiError('Not your app', 403)
    }

    return apiSuccess(result.feedback)
  } catch (error) {
    if (error instanceof AuthError) {
      return error.response
    }
    if (error instanceof ForbiddenError) {
      return error.response
    }
    reportApiError(request, error, 'developer_reply_failed')
    return apiError('Reply failed', 500)
  }
}
