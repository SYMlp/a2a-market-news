/**
 * Re-exports from engine core.
 * @see src/lib/engine/
 */
export {
  createSession,
  getSession,
  getOrCreateSession,
  persistSession,
  endSession,
  presentScene,
  extractTurn,
  resolveTurn,
  applyResult,
  processTurn,
  enterScene,
  processMessage,
  enterSceneWithAI,
  processMessageWithAI,
  generateNPCReplyForTurn,
  recordTransitionAndCheck,
  recordEvent,
} from '@/lib/engine'
export { getScene } from './scenes'
