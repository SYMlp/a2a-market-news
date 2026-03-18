import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/**
 * POST /api/developer/feedbacks/[id]/reply
 * Developer replies to a feedback on their app.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 })
    }
    if (!user.isDeveloper) {
      return NextResponse.json({ error: 'Not a developer' }, { status: 403 })
    }

    const { id } = await params

    const feedback = await prisma.appFeedback.findUnique({
      where: { id },
      include: { app: { select: { developerId: true } } },
    })

    if (!feedback) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 })
    }

    if (feedback.app?.developerId !== user.id && feedback.developerId !== user.id) {
      return NextResponse.json({ error: 'Not your app' }, { status: 403 })
    }

    const body = await request.json()
    const { reply } = body as { reply?: string }

    if (!reply?.trim()) {
      return NextResponse.json({ error: 'Reply cannot be empty' }, { status: 400 })
    }

    const updated = await prisma.appFeedback.update({
      where: { id },
      data: {
        developerReply: reply.trim(),
        developerReplyAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Developer reply failed:', error)
    return NextResponse.json({ error: 'Reply failed' }, { status: 500 })
  }
}
