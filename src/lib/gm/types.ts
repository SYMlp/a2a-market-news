/* GM Script Engine — shared types
 *
 * Architecture: docs/game-loop-architecture.md
 * Two-level binary decision model:
 *   L1: REST | ACT
 *   L2 (ACT only): STAY | MOVE
 */

// ─── Primitives ──────────────────────────────────

export interface DualText {
  pa: string
  agent: string
}

export interface FunctionCall {
  name: string
  args: Record<string, unknown>
}

export type TransitionType = 'enter_space' | 'sub_flow' | 'external'

// ─── Turn Model (L1: what the player decides) ────

export type PlayerTurn =
  | { type: 'rest'; seconds: number }
  | { type: 'act'; actionId: string; params?: Record<string, unknown> }

// ─── Turn Outcome (L2: what happens after ACT) ───

export type TurnOutcome = TurnOutcomeStay | TurnOutcomeMove

export interface TurnOutcomeStay {
  type: 'stay'
  effect: SceneEffect
  message: DualText
}

export interface TurnOutcomeMove {
  type: 'move'
  target: string
  transitionType: TransitionType
  message: DualText
}

export interface SceneEffect {
  dataUpdate?: Record<string, unknown>
  functionCall: FunctionCall
  refreshData?: boolean
}

// ─── Scene Presentation (what the player sees) ───

export interface ScenePresentation {
  sceneId: string
  opening: DualText
  actions: ActionSlot[]
  meta: MetaActionType[]
  data?: Record<string, unknown>
}

export type MetaActionType = 'rest' | 'back' | 'help'

export interface ActionSlot {
  id: string
  label: DualText
  outcome: 'stay' | 'move'
  available: boolean
  disabledReason?: string
  params?: ParamSpec[]
}

export interface ParamSpec {
  name: string
  required: boolean
  description?: string
}

// ─── Scene Definition (v2) ────────────────────────

export interface SceneAction {
  id: string
  outcome: 'stay' | 'move'
  label: DualText
  triggers: string[]
  actIntent?: string
  response: DualText
  functionCall: FunctionCall
  transition?: { type: TransitionType; target?: string }
  precondition?: {
    check: string
    failMessage: DualText
  }
  params?: ParamSpec[]
}

export interface Scene {
  id: string
  opening: DualText
  dataLoader?: string
  actions: SceneAction[]
  fallback: {
    response: DualText
  }
  theme: {
    accent: string
    icon: string
    label: string
  }
}

// ─── Session ──────────────────────────────────────

export interface GameSession {
  id: string
  currentScene: string
  round: number
  mode: 'manual' | 'auto'
  agentId?: string
  agentName?: string
  data?: Record<string, unknown>
  flags?: Record<string, unknown>
  createdAt: number
  lastActiveAt: number
}

// ─── API Request/Response ─────────────────────────

export interface TurnRequest {
  sessionId: string
  turn: PlayerTurn
}

export interface TurnResponse {
  sessionId: string
  scene: { id: string; label: DualText }
  message: DualText
  actions: ActionSlot[]
  meta: MetaActionType[]
  outcome?: {
    type: 'stay' | 'move'
    functionCall?: FunctionCall
    transition?: { from: string; to: string }
  }
  data?: Record<string, unknown>
  delay?: number
}

// ─── Legacy compat (v1 types, used by existing code) ───

/** @deprecated Use SceneAction instead */
export interface SceneOption {
  id: string
  triggers: string[]
  actIntent?: string
  response: DualText
  functionCall: {
    name: string
    args: Record<string, unknown>
  }
  transition: SceneTransition
}

/** @deprecated Use TransitionType instead */
export interface SceneTransition {
  type: 'enter_space' | 'sub_flow' | 'external' | 'hub'
  target?: string
}

/** @deprecated Use GameSession instead */
export type GMSession = GameSession

/** @deprecated Use TurnResponse instead */
export interface GMResponse {
  message: DualText
  currentScene: string
  sessionId: string
  data?: Record<string, unknown>
  availableActions?: Array<{
    action: string
    description: string
    params?: Record<string, string>
  }>
  functionCall?: {
    name: string
    args: Record<string, unknown>
    status: 'pending' | 'executed'
  }
  sceneTransition?: {
    from: string
    to: string
    type: SceneTransition['type']
  }
}
