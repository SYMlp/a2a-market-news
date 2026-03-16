import type {
  GMSession,
  GMResponse,
  SceneOption,
  DualText,
} from './types'
import { getScene, SCENES } from './scenes'

const sessions = new Map<string, GMSession>()

const SESSION_TTL = 30 * 60 * 1000 // 30 min

export function createSession(
  mode: 'manual' | 'auto',
  agentId?: string,
  agentName?: string,
): GMSession {
  const session: GMSession = {
    id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    currentScene: 'lobby',
    round: 0,
    mode,
    agentId,
    agentName,
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  }
  sessions.set(session.id, session)
  return session
}

export function getSession(id: string): GMSession | null {
  const s = sessions.get(id)
  if (!s) return null
  if (Date.now() - s.lastActiveAt > SESSION_TTL) {
    sessions.delete(id)
    return null
  }
  return s
}

export function getOrCreateSession(
  sessionId: string | undefined,
  mode: 'manual' | 'auto',
  agentId?: string,
  agentName?: string,
): GMSession {
  if (sessionId) {
    const existing = getSession(sessionId)
    if (existing) return existing
  }
  return createSession(mode, agentId, agentName)
}

/**
 * Enter a scene: returns the scene's opening message + available actions.
 * This is the first thing PA/Agent sees when arriving at a space.
 */
export async function enterScene(
  session: GMSession,
  sceneId: string,
  sceneData?: Record<string, unknown>,
): Promise<GMResponse> {
  const prevScene = session.currentScene
  const scene = getScene(sceneId)

  session.currentScene = sceneId
  session.round = 0
  session.data = sceneData
  session.lastActiveAt = Date.now()
  sessions.set(session.id, session)

  const opening = fillTemplate(scene.opening, sceneData)

  return {
    message: opening,
    currentScene: scene.id,
    sessionId: session.id,
    data: sceneData,
    availableActions: scene.options.map(o => ({
      action: o.id,
      description: o.response.agent.split('.')[0],
      params: extractParams(o),
    })),
    sceneTransition: prevScene !== sceneId
      ? { from: prevScene, to: sceneId, type: 'enter_space' }
      : undefined,
  }
}

/**
 * Process a message from PA/Agent within the current scene.
 * Matches intent → generates response + function call + transition.
 */
export async function processMessage(
  session: GMSession,
  message: string,
): Promise<GMResponse> {
  const scene = getScene(session.currentScene)
  session.lastActiveAt = Date.now()

  // Round limit reached → re-present current scene options (PA can stay as long as they want)
  if (session.round >= scene.maxRounds) {
    session.round = 0
    sessions.set(session.id, session)
  }

  // Try to match an option
  const matched = matchOption(scene.options, message)

  if (matched) {
    const response = fillTemplate(matched.response, session.data)
    const fc = {
      name: matched.functionCall.name,
      args: { ...matched.functionCall.args, _message: message },
      status: 'pending' as const,
    }

    // Execute transition
    if (matched.transition.type === 'enter_space' && matched.transition.target) {
      session.currentScene = matched.transition.target
      session.round = 0
    } else if (matched.transition.type === 'hub') {
      session.currentScene = 'lobby'
      session.round = 0
    } else {
      session.round++
    }
    sessions.set(session.id, session)

    return {
      message: response,
      currentScene: session.currentScene,
      sessionId: session.id,
      data: session.data,
      functionCall: fc,
      sceneTransition: matched.transition.target
        ? { from: scene.id, to: matched.transition.target, type: matched.transition.type }
        : undefined,
      availableActions: getActionsForScene(session.currentScene),
    }
  }

  // No match → fallback
  session.round++
  sessions.set(session.id, session)

  return {
    message: fillTemplate(scene.fallback.response, session.data),
    currentScene: session.currentScene,
    sessionId: session.id,
    data: session.data,
    availableActions: getActionsForScene(session.currentScene),
  }
}

function navigateToHub(session: GMSession): GMResponse {
  const from = session.currentScene
  session.currentScene = 'lobby'
  session.round = 0
  sessions.set(session.id, session)

  const lobby = getScene('lobby')
  return {
    message: {
      pa: '带你回大厅，重新选择想去的地方吧！',
      agent: 'Returning to lobby.',
    },
    currentScene: 'lobby',
    sessionId: session.id,
    sceneTransition: { from, to: 'lobby', type: 'enter_space' },
    availableActions: lobby.options.map(o => ({
      action: o.id,
      description: o.response.agent.split('.')[0],
      params: extractParams(o),
    })),
  }
}

/**
 * Keyword matching: check if the message contains any trigger words.
 * First match wins — options are ordered by priority in scene definition.
 */
function matchOption(options: SceneOption[], message: string): SceneOption | null {
  const lower = message.toLowerCase()
  for (const opt of options) {
    for (const trigger of opt.triggers) {
      if (lower.includes(trigger.toLowerCase())) {
        return opt
      }
    }
  }
  return null
}

function fillTemplate(
  text: DualText,
  data?: Record<string, unknown>,
): DualText {
  if (!data) return text
  return {
    pa: replaceVars(text.pa, data),
    agent: replaceVars(text.agent, data),
  }
}

function replaceVars(s: string, data: Record<string, unknown>): string {
  return s.replace(/\{(\w+)\}/g, (match, key) => {
    const val = data[key]
    if (val === undefined || val === null) return match
    if (typeof val === 'string') return val
    return JSON.stringify(val)
  })
}

function extractParams(option: SceneOption): Record<string, string> | undefined {
  const args = option.functionCall.args
  if (!args || Object.keys(args).length === 0) return undefined
  const params: Record<string, string> = {}
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === 'string' && v.startsWith('{')) {
      params[k] = 'required'
    }
  }
  return Object.keys(params).length > 0 ? params : undefined
}

function getActionsForScene(sceneId: string) {
  const scene = SCENES[sceneId]
  if (!scene) return []
  return scene.options.map(o => ({
    action: o.id,
    description: o.response.agent.split('.')[0],
    params: extractParams(o),
  }))
}

export { SCENES }
