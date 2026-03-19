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
} from './prompts'

export {
  loadAllNPCSpecs,
  getNPCSpec,
  clearNPCSpecCache,
} from './npc-loader'

export {
  isWithinScope,
  buildScopeConstraint,
  checkScopeAndRedirect,
  canPABeNPC,
} from './scope'

export type { ScopeCheckResult } from './scope'
