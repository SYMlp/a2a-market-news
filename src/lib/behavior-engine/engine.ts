/**
 * Behavior Engine — Core Orchestrator
 *
 * Ties the registry and strategies together. Three entry points
 * consumed by the route handler and session context builder:
 *
 * - processBehavior()           → intercept message if active behavior handles it
 * - buildBehaviorCognition()    → inject cognition into PA/NPC/classifier prompts
 * - buildBehaviorPresentation() → provide presentation data for frontend
 *
 * Architecture: docs/behavior-spec-architecture.md
 * Plan: behavior_engine plan §P3
 */

import type { GameSession } from '../engine/types'
import type {
  BehaviorResult,
  BehaviorUserContext,
  PresentationData,
  ActiveBehavior,
  ResolutionType,
} from './types'
import type { ResolutionStrategy } from './strategies/types'
import { getBehaviorById, getBehaviorsForScene } from './registry'
import { selectOneStrategy } from './strategies/select-one'
import { subflowStrategy } from './strategies/subflow'
import { freeResponseStrategy } from './strategies/free-response'
import { navigateStrategy } from './strategies/navigate'

// ─── Strategy Dispatch ───────────────────────────

const STRATEGIES: Record<ResolutionType, ResolutionStrategy> = {
  select_one: selectOneStrategy,
  subflow: subflowStrategy,
  free_response: freeResponseStrategy,
  navigate: navigateStrategy,
}

function getStrategy(type: ResolutionType): ResolutionStrategy {
  return STRATEGIES[type]
}

// ─── Public API ──────────────────────────────────

/**
 * Check for an active intercepting behavior and handle the message.
 * Returns BehaviorResult if the behavior intercepted it, null if game loop should proceed.
 */
export async function processBehavior(
  session: GameSession,
  message: string,
  user: BehaviorUserContext,
): Promise<BehaviorResult | null> {
  const active = session.flags?.activeBehavior as ActiveBehavior | undefined
  if (!active) return null

  const spec = getBehaviorById(active.specId)
  if (!spec) return null

  const strategy = getStrategy(active.type)
  if (!strategy.interceptsMessages || !strategy.handleMessage) return null

  return strategy.handleMessage(spec, session, message, user)
}

/**
 * Build cognition context for a specific prompt target.
 * Collects cognition from all behaviors available in the current scene.
 * Returns concatenated context string, or null if no behaviors contribute.
 */
export function buildBehaviorCognition(
  session: GameSession,
  target: 'pa' | 'npc' | 'classifier',
): string | null {
  const behaviors = getBehaviorsForScene(session.currentScene)
  if (behaviors.length === 0) return null

  const parts: string[] = []

  for (const spec of behaviors) {
    const strategy = getStrategy(spec.resolution.type)
    const cognition = strategy.buildCognition(spec, session, target)
    if (!cognition) continue

    const text = target === 'pa'
      ? cognition.forPA
      : target === 'npc'
        ? cognition.forNPC
        : cognition.forClassifier

    if (text) parts.push(text)
  }

  return parts.length > 0 ? parts.join('\n\n') : null
}

/**
 * Build presentation data for the frontend.
 * Checks the active behavior first, then falls back to scene-level behaviors.
 * Returns structured data for rendering, or null.
 */
export function buildBehaviorPresentation(
  session: GameSession,
): PresentationData | null {
  const active = session.flags?.activeBehavior as ActiveBehavior | undefined
  if (active) {
    const spec = getBehaviorById(active.specId)
    if (spec) {
      const strategy = getStrategy(active.type)
      const presentation = strategy.buildPresentation(spec, session)
      if (presentation) return presentation
    }
  }

  const behaviors = getBehaviorsForScene(session.currentScene)
  for (const spec of behaviors) {
    const strategy = getStrategy(spec.resolution.type)
    const presentation = strategy.buildPresentation(spec, session)
    if (presentation) return presentation
  }

  return null
}

/**
 * Activate a behavior on the session. Loads the spec from registry
 * and delegates to the strategy's activate method.
 */
export function activateBehavior(
  session: GameSession,
  specId: string,
  context?: Record<string, unknown>,
): void {
  const spec = getBehaviorById(specId)
  if (!spec) return

  const strategy = getStrategy(spec.resolution.type)
  strategy.activate(spec, session, context)
}

/**
 * Deactivate the current behavior on the session.
 */
export function deactivateBehavior(session: GameSession): void {
  const active = session.flags?.activeBehavior as ActiveBehavior | undefined
  if (!active) return

  const spec = getBehaviorById(active.specId)
  if (!spec) {
    if (session.flags) {
      const rest = { ...session.flags }
      delete rest.activeBehavior
      session.flags = rest
    }
    return
  }

  const strategy = getStrategy(active.type)
  strategy.deactivate(spec, session)
}

/**
 * Serialize PresentationData to a frontend-safe payload.
 * Strips the full BehaviorSpec (which contains prompt templates)
 * and sends only what the frontend needs for rendering.
 */
export function serializePresentation(
  p: PresentationData | null,
): { style: string; data: unknown[]; card?: unknown; animation?: unknown } | undefined {
  if (!p) return undefined
  return {
    style: p.style,
    data: p.data,
    card: p.spec.presentation?.card,
    animation: p.spec.presentation?.animation,
  }
}
