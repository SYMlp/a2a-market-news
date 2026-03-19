/**
 * free_response Resolution Strategy
 *
 * Enriching mode: game loop handles everything.
 * This strategy only contributes cognition context when the spec declares it.
 * No presentation — free responses render as plain chat.
 *
 * Architecture: docs/behavior-spec-architecture.md §2.5
 * Plan: behavior_engine plan §P2-3
 */

import type { GameSession } from '../../engine/types'
import type {
  BehaviorSpec,
  CognitionContext,
  PresentationData,
  ActiveBehavior,
} from '../types'
import type { ResolutionStrategy } from './types'

export const freeResponseStrategy: ResolutionStrategy = {
  type: 'free_response',
  interceptsMessages: false,

  buildCognition(
    spec: BehaviorSpec,
    _session: GameSession,
    target: 'pa' | 'npc' | 'classifier',
  ): CognitionContext | null {
    if (!spec.cognition) return null

    const result: CognitionContext = {}
    if (target === 'pa' && spec.cognition.forPA) result.forPA = spec.cognition.forPA
    if (target === 'npc' && spec.cognition.forNPC) result.forNPC = spec.cognition.forNPC
    if (target === 'classifier' && spec.cognition.forClassifier) result.forClassifier = spec.cognition.forClassifier

    return (result.forPA || result.forNPC || result.forClassifier) ? result : null
  },

  buildPresentation(
    _spec: BehaviorSpec,
    _session: GameSession,
  ): PresentationData | null {
    return null
  },

  activate(
    spec: BehaviorSpec,
    session: GameSession,
    context?: Record<string, unknown>,
  ): void {
    const active: ActiveBehavior = {
      specId: spec.id,
      type: 'free_response',
      state: context ?? {},
      activatedAt: Date.now(),
    }
    session.flags = { ...session.flags, activeBehavior: active }
  },

  deactivate(
    _spec: BehaviorSpec,
    session: GameSession,
  ): void {
    if (session.flags) {
      const { activeBehavior: _, ...rest } = session.flags
      session.flags = rest
    }
  },
}
