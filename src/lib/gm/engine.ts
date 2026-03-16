import type {
  GameSession,
  SceneAction,
  DualText,
  PlayerTurn,
  TurnOutcome,
  TurnResponse,
  ScenePresentation,
  ActionSlot,
  MetaActionType,
  GMResponse,
} from './types'
import { getScene, SCENES } from './scenes'

// ─── Session Store ───────────────────────────────

const sessions = new Map<string, GameSession>()
const SESSION_TTL = 30 * 60 * 1000

export function createSession(
  mode: 'manual' | 'auto',
  agentId?: string,
  agentName?: string,
): GameSession {
  const session: GameSession = {
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

export function getSession(id: string): GameSession | null {
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
): GameSession {
  if (sessionId) {
    const existing = getSession(sessionId)
    if (existing) return existing
  }
  return createSession(mode, agentId, agentName)
}

// ─── V2 Core: Game Loop ─────────────────────────

export function presentScene(session: GameSession): ScenePresentation {
  const scene = getScene(session.currentScene)
  return {
    sceneId: scene.id,
    opening: fillTemplate(scene.opening, session.data),
    actions: scene.actions.map(a => toActionSlot(a, session)),
    meta: buildMetaActions(scene.id),
    data: session.data,
  }
}

export function extractTurn(message: string, sceneId: string): PlayerTurn {
  const scene = getScene(sceneId)
  const matched = matchAction(scene.actions, message)
  if (matched) {
    return { type: 'act', actionId: matched.id }
  }
  return { type: 'act', actionId: '_fallback' }
}

export function resolveTurn(session: GameSession, turn: PlayerTurn): TurnOutcome {
  const scene = getScene(session.currentScene)

  if (turn.type === 'rest') {
    return {
      type: 'stay',
      effect: {
        functionCall: { name: 'GM.rest', args: { seconds: turn.seconds } },
        refreshData: true,
      },
      message: {
        pa: `休息一下，${turn.seconds}秒后看看有什么新动态。`,
        agent: `Resting for ${turn.seconds}s. Scene data will refresh.`,
      },
    }
  }

  if (turn.actionId === '_back') {
    return {
      type: 'move',
      target: 'lobby',
      transitionType: 'enter_space',
      message: { pa: '好的，回大厅了！', agent: 'Returning to lobby.' },
    }
  }

  if (turn.actionId === '_help') {
    return {
      type: 'stay',
      effect: {
        functionCall: { name: 'GM.help', args: {} },
        refreshData: false,
      },
      message: fillTemplate(scene.opening, session.data),
    }
  }

  const action = scene.actions.find(a => a.id === turn.actionId)
  if (!action) {
    return {
      type: 'stay',
      effect: {
        functionCall: { name: 'GM.fallback', args: {} },
        refreshData: false,
      },
      message: fillTemplate(scene.fallback.response, session.data),
    }
  }

  if (action.outcome === 'stay') {
    return {
      type: 'stay',
      effect: {
        functionCall: action.functionCall,
        refreshData: true,
      },
      message: fillTemplate(action.response, session.data),
    }
  }

  return {
    type: 'move',
    target: action.transition?.target || 'lobby',
    transitionType: action.transition?.type || 'enter_space',
    message: fillTemplate(action.response, session.data),
  }
}

export function applyResult(session: GameSession, outcome: TurnOutcome): void {
  if (outcome.type === 'stay') {
    if (outcome.effect.dataUpdate) {
      session.data = { ...session.data, ...outcome.effect.dataUpdate }
    }
    session.round++
  } else {
    session.currentScene = outcome.target
    session.round = 0
  }
  session.lastActiveAt = Date.now()
  sessions.set(session.id, session)
}

export function processTurn(session: GameSession, turn: PlayerTurn): TurnResponse {
  const prevScene = session.currentScene
  const outcome = resolveTurn(session, turn)
  applyResult(session, outcome)

  const presentation = presentScene(session)
  const sceneDef = getScene(session.currentScene)

  return {
    sessionId: session.id,
    scene: {
      id: session.currentScene,
      label: { pa: sceneDef.theme.label, agent: sceneDef.theme.label },
    },
    message: outcome.message,
    actions: presentation.actions,
    meta: presentation.meta,
    outcome: {
      type: outcome.type,
      functionCall: outcome.type === 'stay'
        ? outcome.effect.functionCall
        : undefined,
      transition: outcome.type === 'move'
        ? { from: prevScene, to: outcome.target }
        : undefined,
    },
    data: session.data,
    delay: turn.type === 'rest' ? turn.seconds * 1000 : undefined,
  }
}

// ─── V1 Compat ──────────────────────────────────

export async function enterScene(
  session: GameSession,
  sceneId: string,
  sceneData?: Record<string, unknown>,
): Promise<GMResponse> {
  const prevScene = session.currentScene
  session.currentScene = sceneId
  session.round = 0
  session.data = sceneData
  session.lastActiveAt = Date.now()
  sessions.set(session.id, session)

  const scene = getScene(sceneId)
  const opening = fillTemplate(scene.opening, sceneData)

  return {
    message: opening,
    currentScene: scene.id,
    sessionId: session.id,
    data: sceneData,
    availableActions: scene.actions.map(a => ({
      action: a.id,
      description: a.label.agent,
    })),
    sceneTransition: prevScene !== sceneId
      ? { from: prevScene, to: sceneId, type: 'enter_space' }
      : undefined,
  }
}

export async function processMessage(
  session: GameSession,
  message: string,
): Promise<GMResponse> {
  const prevScene = session.currentScene
  const scene = getScene(prevScene)
  const matched = matchAction(scene.actions, message)

  const turn: PlayerTurn = matched
    ? { type: 'act', actionId: matched.id }
    : { type: 'act', actionId: '_fallback' }

  const outcome = resolveTurn(session, turn)
  applyResult(session, outcome)

  const currentSceneDef = getScene(session.currentScene)
  const response: GMResponse = {
    message: outcome.message,
    currentScene: session.currentScene,
    sessionId: session.id,
    data: session.data,
    availableActions: currentSceneDef.actions.map(a => ({
      action: a.id,
      description: a.label.agent,
    })),
  }

  if (matched) {
    response.functionCall = {
      name: matched.functionCall.name,
      args: { ...matched.functionCall.args, _message: message },
      status: 'pending',
    }
  }

  if (outcome.type === 'move') {
    response.sceneTransition = {
      from: prevScene,
      to: outcome.target,
      type: outcome.transitionType,
    }
  }

  return response
}

// ─── AI-Enhanced Wrappers ───────────────────────

interface VisitorInfo {
  name?: string
  type: 'pa' | 'agent'
}

export async function enterSceneWithAI(
  session: GameSession,
  sceneId: string,
  sceneData?: Record<string, unknown>,
  visitorInfo?: VisitorInfo,
): Promise<GMResponse> {
  const base = await enterScene(session, sceneId, sceneData)

  const { generateNPCReply } = await import('./npc-ai')
  const aiMessage = await generateNPCReply({
    sceneId,
    sceneData,
    visitorInfo,
    isOpening: true,
  })
  base.message = aiMessage

  return base
}

export async function processMessageWithAI(
  session: GameSession,
  message: string,
  visitorInfo?: VisitorInfo,
): Promise<GMResponse> {
  const prevScene = session.currentScene
  const scene = getScene(prevScene)
  const matched = matchAction(scene.actions, message)
  const isFreeChat = !matched

  const base = await processMessage(session, message)

  const { generateNPCReply } = await import('./npc-ai')
  const aiMessage = await generateNPCReply({
    sceneId: isFreeChat ? prevScene : session.currentScene,
    visitorMessage: message,
    sceneData: base.data,
    visitorInfo,
    isFreeChat,
  })
  base.message = aiMessage

  return base
}

// ─── Internal Utilities ─────────────────────────

function toActionSlot(action: SceneAction, session: GameSession): ActionSlot {
  const available = !action.precondition
    || checkPrecondition(action.precondition.check, session)
  return {
    id: action.id,
    label: action.label,
    outcome: action.outcome,
    available,
    disabledReason: !available ? action.precondition?.failMessage.pa : undefined,
    params: action.params,
  }
}

function buildMetaActions(sceneId: string): MetaActionType[] {
  const meta: MetaActionType[] = ['rest', 'help']
  if (sceneId !== 'lobby') meta.push('back')
  return meta
}

function matchAction(actions: SceneAction[], message: string): SceneAction | null {
  const lower = message.toLowerCase()
  for (const action of actions) {
    for (const trigger of action.triggers) {
      if (lower.includes(trigger.toLowerCase())) {
        return action
      }
    }
  }
  return null
}

function checkPrecondition(check: string, session: GameSession): boolean {
  if (check === 'hasExperienced') return session.flags?.hasExperienced === true
  return true
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

export { SCENES }
