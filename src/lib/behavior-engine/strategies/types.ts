/**
 * Behavior Engine — Resolution Strategy Interface
 *
 * Each resolution type (select_one, subflow, free_response, navigate)
 * implements this interface. The engine dispatches to the appropriate
 * strategy based on the spec's resolution.type.
 *
 * Architecture: docs/behavior-spec-architecture.md §2.5
 */

import type { GameSession } from '../../engine/types'
import type {
  BehaviorSpec,
  BehaviorResult,
  BehaviorUserContext,
  CognitionContext,
  PresentationData,
  ResolutionType,
} from '../types'

export interface ResolutionStrategy {
  readonly type: ResolutionType

  /**
   * If true, this strategy takes over message handling — the game loop
   * is bypassed. If false, the game loop still handles classification
   * and resolution; the strategy only enriches cognition/presentation.
   */
  readonly interceptsMessages: boolean

  /**
   * Handle an incoming message when this strategy is active and intercepting.
   * Only called when interceptsMessages is true.
   * Returns BehaviorResult if handled, null to fall through to game loop.
   */
  handleMessage?(
    spec: BehaviorSpec,
    session: GameSession,
    message: string,
    user: BehaviorUserContext,
  ): Promise<BehaviorResult | null>

  /**
   * Build cognition context for a specific prompt target.
   * Returns text to append to the target's prompt, or null if no cognition.
   */
  buildCognition(
    spec: BehaviorSpec,
    session: GameSession,
    target: 'pa' | 'npc' | 'classifier',
  ): CognitionContext | null

  /**
   * Build presentation data for the frontend.
   * Returns structured data for rendering, or null if no presentation.
   */
  buildPresentation(
    spec: BehaviorSpec,
    session: GameSession,
  ): PresentationData | null

  /**
   * Activate this behavior on the session. Sets up any initial state.
   */
  activate(
    spec: BehaviorSpec,
    session: GameSession,
    context?: Record<string, unknown>,
  ): void

  /**
   * Deactivate this behavior. Cleans up state.
   */
  deactivate(
    spec: BehaviorSpec,
    session: GameSession,
  ): void
}
