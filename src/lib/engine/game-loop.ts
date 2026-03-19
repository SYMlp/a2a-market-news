import type {
  GameSession,
  Scene,
  SceneAction,
  DualText,
  PlayerTurn,
  TurnOutcome,
  TurnResponse,
  ScenePresentation,
  ActionSlot,
  MetaActionType,
  GMResponse,
  FCResult,
} from './types'
import { getScene } from '@/lib/scenes'
import { fillTemplate } from './template'
import { matchAction } from './match'
import { checkPrecondition, clearSceneScopedFlags, getReturnContext } from './session-context'
import { getSceneLabel } from './ontology'
import type { VisitorInfo, NPCReplyMeta } from '@/lib/npc/types'
import { persistSession } from './session'
import { checkAndRecord, resetGuard } from './conversation-guard'
import { activateBehavior, deactivateBehavior, getBehaviorsForScene } from '@/lib/behavior-engine'

export function resolveOpening(scene: Scene, isFirstVisit: boolean): DualText {
  if (isFirstVisit || !scene.opening.return) {
    return scene.opening.first
  }
  return scene.opening.return
}

// ─── V2 Core: Game Loop ─────────────────────────

export function presentScene(session: GameSession): ScenePresentation {
  const scene = getScene(session.currentScene)
  const visited = (session.flags?.visitedScenes as string[]) || []
  const isFirstVisit = !visited.includes(scene.id)
  return {
    sceneId: scene.id,
    opening: fillTemplate(resolveOpening(scene, isFirstVisit), session.data),
    actions: scene.actions.map(a => toActionSlot(a, session)),
    meta: buildMetaActions(scene.id),
    data: session.data,
  }
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
      message: fillTemplate(scene.opening.first, session.data),
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

  const message = action.response
    ? fillTemplate(action.response, session.data)
    : { pa: '', agent: `Action: ${action.id}. Outcome: ${action.outcome}.` }

  if (action.outcome === 'stay') {
    return {
      type: 'stay',
      effect: {
        functionCall: action.functionCall,
        refreshData: true,
      },
      message,
    }
  }

  return {
    type: 'move',
    target: action.transition?.target || 'lobby',
    transitionType: action.transition?.type || 'enter_space',
    message,
  }
}

export function applyResult(session: GameSession, outcome: TurnOutcome): void {
  session.globalTurn++
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
  persistSession(session)
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
  if (prevScene !== sceneId) {
    deactivateBehavior(session)
    clearSceneScopedFlags(session)
    resetGuard(session)
  }
  session.currentScene = sceneId
  session.round = 0
  session.data = sceneData
  session.lastActiveAt = Date.now()

  const visited = (session.flags?.visitedScenes as string[]) || []
  const isFirstVisit = !visited.includes(sceneId)
  if (isFirstVisit) {
    session.flags = { ...session.flags, visitedScenes: [...visited, sceneId] }
  }

  if (sceneId === 'lobby' && !isFirstVisit) {
    const rc = getReturnContext(session)
    const recLabel = rc?.recommendation ? getSceneLabel(rc.recommendation) : ''
    session.data = {
      ...session.data,
      returnFromLabel: rc ? getSceneLabel(rc.fromScene) : '其他场景',
      returnSummary: rc?.summary || '逛了一圈回来了',
      recommendedHint: recLabel ? `建议去「${recLabel}」看看——` : '',
    }
  }

  persistSession(session)

  // Activate onSceneEnter behaviors (e.g. browse_apps in news scene)
  for (const spec of getBehaviorsForScene(sceneId)) {
    if (!spec.availability.trigger.onSceneEnter) continue
    const preconsMet = !spec.availability.preconditions
      || spec.availability.preconditions.every(p => checkPrecondition(p, session))
    if (preconsMet) {
      activateBehavior(session, spec.id)
      break
    }
  }

  const scene = getScene(sceneId)
  const opening = fillTemplate(resolveOpening(scene, isFirstVisit), session.data)

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

export async function enterSceneWithAI(
  session: GameSession,
  sceneId: string,
  sceneData?: Record<string, unknown>,
  visitorInfo?: VisitorInfo,
): Promise<GMResponse> {
  const visited = (session.flags?.visitedScenes as string[]) || []
  const isFirstVisit = !visited.includes(sceneId)

  const base = await enterScene(session, sceneId, sceneData)

  const scene = getScene(sceneId)
  const { buildSessionContextForNPC } = await import('./session-context')
  const sessionContext = buildSessionContextForNPC(session, scene.actions)

  const { generateNPCReply } = await import('@/lib/npc')
  const aiMessage = await generateNPCReply({
    sceneId,
    sceneData,
    visitorInfo,
    entryType: isFirstVisit ? 'first' : 'return',
    sessionContext,
  })
  base.message = aiMessage

  return base
}

export interface ProcessMessageResult extends GMResponse {
  _turnMeta: {
    prevScene: string
    isFreeChat: boolean
    outcome: TurnOutcome
    visitorInfo?: VisitorInfo
    originalMessage?: string
    classifierConfidence?: number
    classifierSource?: 'ai' | 'keyword' | 'cache'
  }
  _npcMeta?: NPCReplyMeta
}

/**
 * Classify + resolve + apply. Does NOT generate NPC reply.
 * Caller must execute FC, then call generateNPCReplyForTurn().
 */
export async function processMessageWithAI(
  session: GameSession,
  message: string,
  visitorInfo?: VisitorInfo,
  originalMessage?: string,
  accessToken?: string,
): Promise<ProcessMessageResult> {
  const prevScene = session.currentScene
  const scene = getScene(prevScene)

  const { classifyAction } = await import('./ai-classifier')
  const classified = await classifyAction({ scene, message, accessToken, session })
  const matched = classified.actionId
    ? scene.actions.find(a => a.id === classified.actionId) ?? null
    : null
  const isFreeChat = !matched

  const turn: PlayerTurn = matched
    ? { type: 'act', actionId: matched.id }
    : { type: 'act', actionId: '_fallback' }
  const outcome = resolveTurn(session, turn)
  applyResult(session, outcome)

  const currentSceneDef = getScene(session.currentScene)
  const response: ProcessMessageResult = {
    message: outcome.message,
    currentScene: session.currentScene,
    sessionId: session.id,
    data: session.data,
    availableActions: currentSceneDef.actions.map(a => ({
      action: a.id,
      description: a.label.agent,
    })),
    _turnMeta: {
      prevScene, isFreeChat, outcome, visitorInfo, originalMessage,
      classifierConfidence: classified.confidence,
      classifierSource: classified.source,
    },
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

/**
 * Generate NPC reply AFTER function call has executed.
 * Receives FC result so NPC knows what actually happened.
 *
 * For MOVE outcomes, skip AI generation — the template farewell from
 * resolveTurn is sufficient. The arriving scene will generate its own
 * opening via enterSceneWithAI. Generating here would use the wrong
 * scene's NPC (session.currentScene is already updated by applyResult).
 */
export async function generateNPCReplyForTurn(
  session: GameSession,
  response: ProcessMessageResult,
  fcResult?: FCResult,
): Promise<void> {
  const { _turnMeta } = response

  if (_turnMeta.outcome.type === 'move') {
    return
  }

  const scene = getScene(_turnMeta.isFreeChat ? _turnMeta.prevScene : session.currentScene)

  const { buildSessionContextForNPC } = await import('./session-context')
  const sessionContext = buildSessionContextForNPC(session, scene.actions, fcResult)

  const hist = session.flags?._conversationHistory as { npcMessages?: string[] } | undefined
  const recentNpcMessages = hist?.npcMessages?.slice(-3) ?? []

  const { generateNPCReply } = await import('@/lib/npc')
  const aiMessage = await generateNPCReply({
    sceneId: scene.id,
    visitorMessage: _turnMeta.originalMessage || response.message.pa,
    sceneData: response.data,
    visitorInfo: _turnMeta.visitorInfo,
    isFreeChat: _turnMeta.isFreeChat,
    outcome: _turnMeta.outcome,
    sessionContext,
    fcResult,
    recentNpcMessages,
  })

  response._npcMeta = aiMessage.meta

  const guardOverride = checkAndRecord(session, aiMessage.pa, scene.id)
  response.message = guardOverride ?? aiMessage
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

