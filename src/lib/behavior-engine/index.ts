/**
 * Behavior Engine — Public API
 *
 * Re-exports the engine's public interface. Import from here,
 * not from individual modules.
 */

export {
  processBehavior,
  buildBehaviorCognition,
  buildBehaviorPresentation,
  activateBehavior,
  deactivateBehavior,
  serializePresentation,
} from './engine'

export type {
  BehaviorSpec,
  ResolutionType,
  CognitionContext,
  PresentationData,
  BehaviorResult,
  ActiveBehavior,
  BehaviorUserContext,
  BehaviorAvailability,
  BehaviorCognition,
  BehaviorPresentation,
  BehaviorResolution,
} from './types'

export {
  loadBehaviorSpecs,
  getBehaviorsForScene,
  getBehaviorByTrigger,
  getBehaviorById,
  resetBehaviorRegistry,
} from './registry'
