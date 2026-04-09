import { prisma } from '@/lib/prisma'

export async function getDeveloperProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      developerName: true,
      callbackUrl: true,
      notifyPreference: true,
    },
  })
}

export async function updateDeveloperProfile(
  userId: string,
  body: {
    developerName?: unknown
    callbackUrl?: unknown
    notifyPreference?: unknown
  },
) {
  const data: Record<string, unknown> = {}

  if (body.developerName !== undefined) {
    const v = body.developerName as string | null | undefined
    data.developerName = v?.trim() || null
  }
  if (body.callbackUrl !== undefined) {
    const v = body.callbackUrl as string | null | undefined
    data.callbackUrl = v?.trim() || null
  }
  if (body.notifyPreference !== undefined) {
    const validPrefs = ['none', 'callback', 'in_app', 'both']
    if (typeof body.notifyPreference === 'string' && validPrefs.includes(body.notifyPreference)) {
      data.notifyPreference = body.notifyPreference
    }
  }

  return prisma.user.update({
    where: { id: userId },
    data,
  })
}
