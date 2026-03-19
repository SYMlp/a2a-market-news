import type { NextRequest } from 'next/server'
import type { GameSession, SceneAchievement } from '@/lib/engine/types'

export function buildSessionSummary(session: GameSession) {
  const scenesVisited = (session.flags?.visitedScenes ?? []) as string[]
  const achievements = (session.flags?.achievements ?? []) as SceneAchievement[]
  return {
    scenesVisited,
    achievements,
    totalTurns: session.globalTurn,
  }
}

export function resolveAppFromMessage(
  message: string,
  apps: Array<{ name: string; clientId: string; website?: string }>,
): { name: string; clientId: string; website?: string } | null {
  if (apps.length === 0) return null

  const indexMatch = message.match(/第?([一二三四五1-5])[个号]?/)
  if (indexMatch) {
    const map: Record<string, number> = { '一': 0, '二': 1, '三': 2, '四': 3, '五': 4, '1': 0, '2': 1, '3': 2, '4': 3, '5': 4 }
    const idx = map[indexMatch[1]]
    if (idx !== undefined && idx < apps.length) return apps[idx]
  }

  for (const app of apps) {
    if (message.includes(app.name)) return app
  }

  return apps[0]
}

export function extractRatingHint(message: string): number {
  if (/太差|很烂|垃圾|不行|难用|差劲|糟糕/u.test(message)) return 1
  if (/一般|普通|马马虎虎|还行吧/u.test(message)) return 3
  if (/不错|还行|可以|还好|挺好/u.test(message)) return 4
  if (/太棒|很好|超赞|优秀|有意思|有创意|厉害|绝了/u.test(message)) return 5
  return 4
}

export function buildPreconditionState(
  sceneData: Record<string, unknown> | undefined,
  session: GameSession,
): Record<string, boolean> {
  const state: Record<string, boolean> = {}
  if (sceneData) {
    state.isDeveloper = !!sceneData.isDeveloper
    state.notDeveloper = !sceneData.isDeveloper
    state.hasApps = !!sceneData.hasApps
  }
  state.hasExperienced = !!session.flags?.hasExperienced
  return state
}

export async function loadSceneData(
  loader: string,
  request: NextRequest,
  userId: string,
): Promise<Record<string, unknown>> {
  try {
    const origin = new URL(request.url).origin
    const url = new URL(loader, origin)
    url.searchParams.set('userId', userId)

    const res = await fetch(url.toString(), {
      headers: { cookie: request.headers.get('cookie') || '' },
    })
    if (!res.ok) return {}
    const data = await res.json()
    return data.data || data
  } catch {
    return {}
  }
}
