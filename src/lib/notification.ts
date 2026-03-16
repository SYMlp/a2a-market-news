import { prisma } from './prisma'

interface NotifyOptions {
  developerId: string
  feedbackId: string
  appClientId: string
  appName: string
  summary: string
  overallRating: number
}

export async function notifyDeveloper(opts: NotifyOptions) {
  const developer = await prisma.user.findUnique({
    where: { id: opts.developerId },
  })
  if (!developer) return

  const feedbackCount = await prisma.appFeedback.count({
    where: { developerId: opts.developerId, targetClientId: opts.appClientId },
  })

  if (developer.callbackUrl && ['callback', 'both'].includes(developer.notifyPreference)) {
    const callbackPayload = {
      type: 'new_feedback',
      appClientId: opts.appClientId,
      appName: opts.appName,
      feedbackCount,
      latestSummary: opts.summary,
      overallRating: opts.overallRating,
      viewUrl: `/developer/apps/${opts.appClientId}/feedbacks`,
    }

    let status = 'sent'
    let responseData: { status?: number; ok?: boolean; error?: string } | null = null

    try {
      const res = await fetch(developer.callbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(callbackPayload),
        signal: AbortSignal.timeout(10_000),
      })
      responseData = { status: res.status, ok: res.ok }
      if (!res.ok) status = 'failed'
    } catch (err) {
      status = 'failed'
      responseData = { error: String(err) }
    }

    await prisma.notificationLog.create({
      data: {
        developerId: opts.developerId,
        feedbackId: opts.feedbackId,
        channel: 'callback',
        status,
        response: responseData ?? undefined,
      },
    })
  }

  if (['in_app', 'both', 'none'].includes(developer.notifyPreference)) {
    await prisma.notificationLog.create({
      data: {
        developerId: opts.developerId,
        feedbackId: opts.feedbackId,
        channel: 'in_app',
        status: 'sent',
      },
    })
  }
}
