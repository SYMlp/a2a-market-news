import { prisma } from '@/lib/prisma'

const VALID_PREFS = ['none', 'callback', 'in_app', 'both'] as const

export async function registerAsDeveloper(
  userId: string,
  body: {
    developerName?: unknown
    callbackUrl?: unknown
    notifyPreference?: unknown
  },
) {
  const developerName = typeof body.developerName === 'string' ? body.developerName : ''
  if (!developerName.trim()) {
    return { ok: false as const, status: 400, message: 'developerName is required' }
  }

  const pref =
    typeof body.notifyPreference === 'string' && VALID_PREFS.includes(body.notifyPreference as (typeof VALID_PREFS)[number])
      ? body.notifyPreference
      : 'in_app'

  const callbackUrl =
    typeof body.callbackUrl === 'string' ? body.callbackUrl.trim() || null : null

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      isDeveloper: true,
      developerName: developerName.trim(),
      callbackUrl,
      notifyPreference: pref,
    },
  })

  return {
    ok: true as const,
    data: {
      id: updated.id,
      isDeveloper: updated.isDeveloper,
      developerName: updated.developerName,
      callbackUrl: updated.callbackUrl,
      notifyPreference: updated.notifyPreference,
    },
  }
}
