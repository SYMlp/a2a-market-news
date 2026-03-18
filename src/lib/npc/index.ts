export type {
  NPCConfig,
  NPCSeedData,
  VisitorInfo,
  NPCReplyContext,
  NPCReplyResult,
  NPCReplyMeta,
} from './types'

export {
  generateNPCReply,
  getNPCForScene,
} from './engine'

export {
  buildNPCMessage,
  buildAgentText,
  NPC_SEEDS,
} from './prompts'

export {
  isWithinScope,
  buildScopeConstraint,
  checkScopeAndRedirect,
  canPABeNPC,
} from './scope'

export type { ScopeCheckResult } from './scope'
