import type { GameSession } from './types'
import { getHubSceneId } from './ontology'

const sessions = new Map<string, GameSession>()
const SESSION_TTL = 30 * 60 * 1000

export function createSession(
  mode: 'manual' | 'auto' | 'advisor',
  agentId?: string,
  agentName?: string,
): GameSession {
  const session: GameSession = {
    id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    currentScene: getHubSceneId(),
    round: 0,
    globalTurn: 0,
    mode,
    agentId,
    agentName,
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  }
  sessions.set(session.id, session)
  return session
}

export function getSession(id: string): GameSession | null {
  const s = sessions.get(id)
  if (!s) return null
  if (s.ended) return null
  if (Date.now() - s.lastActiveAt > SESSION_TTL) {
    sessions.delete(id)
    return null
  }
  return s
}

export function getOrCreateSession(
  sessionId: string | undefined,
  mode: 'manual' | 'auto' | 'advisor',
  agentId?: string,
  agentName?: string,
): GameSession {
  if (sessionId) {
    const existing = getSession(sessionId)
    if (existing) {
      if (existing.mode !== mode) {
        existing.mode = mode
        existing.lastActiveAt = Date.now()
        sessions.set(existing.id, existing)
      }
      return existing
    }
  }
  return createSession(mode, agentId, agentName)
}

export function endSession(
  session: GameSession,
  reason: GameSession['endReason'] = 'pa_leave',
): void {
  session.ended = true
  session.endReason = reason
  session.lastActiveAt = Date.now()
  sessions.set(session.id, session)
}

export function persistSession(session: GameSession): void {
  sessions.set(session.id, session)
}
