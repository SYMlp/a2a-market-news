/**
 * subflow Resolution Strategy
 *
 * Intercepting mode: takes over message handling, bypasses game loop.
 * Delegates to the existing SubFlow router (subflow/router.ts) —
 * this strategy is a thin adapter, not a reimplementation.
 *
 * Architecture: docs/behavior-spec-architecture.md §2.5
 * Plan: behavior_engine plan §P2-2
 */

import type { GameSession } from '../../engine/types'
import type {
  BehaviorSpec,
  BehaviorResult,
  BehaviorUserContext,
  CognitionContext,
  PresentationData,
  ActiveBehavior,
} from '../types'
import type { ResolutionStrategy } from './types'
import {
  routeSubFlow,
  activateSubFlowFromSpec,
} from '../../subflow/router'

export const subflowStrategy: ResolutionStrategy = {
  type: 'subflow',
  interceptsMessages: true,

  async handleMessage(
    spec: BehaviorSpec,
    session: GameSession,
    message: string,
    user: BehaviorUserContext,
  ): Promise<BehaviorResult | null> {
    const response = await routeSubFlow(session, message, user)
    if (!response) return null

    const body = await response.json() as Record<string, unknown>
    const msg = body.message as { pa: string; agent: string } | undefined
    const presentation = buildSubFlowPresentation(spec, session)

    return {
      message: msg ?? { pa: '', agent: 'SubFlow returned no message.' },
      presentation: presentation ?? undefined,
      data: body.data as Record<string, unknown> | undefined,
    }
  },

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

    return hasContent(result) ? result : null
  },

  buildPresentation(
    spec: BehaviorSpec,
    session: GameSession,
  ): PresentationData | null {
    return buildSubFlowPresentation(spec, session)
  },

  activate(
    spec: BehaviorSpec,
    session: GameSession,
    context?: Record<string, unknown>,
  ): void {
    const specName = spec.id
    activateSubFlowFromSpec(session, specName, context ?? {})

    const active: ActiveBehavior = {
      specId: spec.id,
      type: 'subflow',
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

// ─── Helpers ──────────────────────────────────────

function buildSubFlowPresentation(
  spec: BehaviorSpec,
  session: GameSession,
): PresentationData | null {
  const subFlow = session.flags?.subFlow
  if (!subFlow || subFlow.step !== 'confirm') return null

  return {
    style: 'form_card',
    data: subFlow.extracted ? [subFlow.extracted] : [],
    spec,
  }
}

function hasContent(ctx: CognitionContext): boolean {
  return !!(ctx.forPA || ctx.forNPC || ctx.forClassifier)
}
