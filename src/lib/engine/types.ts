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

// ─── Message Envelope (Communication Protocol) ───

export type SenderRole = 'human' | 'pa' | 'npc' | 'gm' | 'system'
export type MessageChannel = 'public' | 'private' | 'system'

export interface MessageMeta {
  intent?: string
  confidence?: number
  goal?: string
  fcName?: string
  fcStatus?: 'executed' | 'skipped' | 'failed'
  scopeAssessment?: 'in_scope' | 'redirect'
  suggestions?: string[]
}

/** Superset of DualText — adds sender, channel, and optional metadata.
 *  Internal engine functions continue to use DualText; conversion to
 *  MessageEnvelope happens at the API boundary via toEnvelope(). */
export interface MessageEnvelope extends DualText {
  sender: SenderRole
  channel: MessageChannel
  meta?: MessageMeta
}

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
  triggers?: string[]
  actIntent: string
  response?: DualText
  functionCall: FunctionCall
  transition?: { type: TransitionType; target?: string }
  precondition?: {
    check: string
    failMessage: DualText
  }
  params?: ParamSpec[]
}

export interface SceneOpening {
  first: DualText
  return?: DualText
}

export interface Scene {
  id: string
  opening: SceneOpening
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

export type SubFlowType = 'register' | 'app_settings' | 'profile' | 'app_lifecycle'

export interface SubFlowState {
  type: SubFlowType
  step: string // 'collect' | 'confirm' | 'done'
  messages: string[]
  context: Record<string, unknown>
  extracted?: Record<string, unknown>
  /** Timestamp when SubFlow was activated (Date.now()), for timeout handling */
  activatedAt?: number
}

export interface SceneScopedFlags {
  experiencingApp?: { name: string; clientId: string }
  hasExperienced?: boolean
  subFlow?: SubFlowState
}

export interface TransitionRecord {
  from: string
  to: string
  turn: number
}

export interface ReturnContext {
  fromScene: string
  npcName: string
  reason: 'no_data' | 'scope_redirect' | 'pa_initiative' | 'task_complete'
  recommendation?: string
  summary: string
}

export interface SceneAchievement {
  sceneId: string
  actionId: string
  label: string
  timestamp: number
}

export interface CrossSceneFlags {
  visitedScenes?: string[]
  totalReports?: number
  transitionHistory?: TransitionRecord[]
  recentEvents?: string[]
  navigatorAttempts?: number
  returnContext?: ReturnContext
  achievements?: SceneAchievement[]
  sceneTurns?: number
}

export type SessionFlags = SceneScopedFlags & CrossSceneFlags & Record<string, unknown>

export interface GameSession {
  id: string
  currentScene: string
  round: number
  globalTurn: number
  mode: 'manual' | 'auto' | 'advisor'
  agentId?: string
  agentName?: string
  data?: Record<string, unknown>
  flags?: SessionFlags
  ended?: boolean
  endReason?: 'pa_leave' | 'loop_guard' | 'timeout' | 'navigator_exhausted'
  createdAt: number
  lastActiveAt: number
}

// ─── Action Constraints (PA Lifecycle) ───────────

export interface ActionConstraint {
  actionId: string
  available: boolean
  reason?: string
}

export interface FCResult {
  name: string
  status: 'executed' | 'skipped' | 'failed'
  detail?: string
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
