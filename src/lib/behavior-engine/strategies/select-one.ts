/**
 * select_one Resolution Strategy
 *
 * Enriching mode: game loop still handles classification and resolution.
 * This strategy injects cognition (formatted item list into PA/NPC prompts)
 * and provides presentation data (card deck for frontend rendering).
 *
 * Architecture: docs/behavior-spec-architecture.md §2.5
 * Plan: behavior_engine plan §P2-1
 */

import type { GameSession } from '../../engine/types'
import type {
  BehaviorSpec,
  CognitionContext,
  PresentationData,
  ActiveBehavior,
} from '../types'
import type { ResolutionStrategy } from './types'

export const selectOneStrategy: ResolutionStrategy = {
  type: 'select_one',
  interceptsMessages: false,

  buildCognition(
    spec: BehaviorSpec,
    session: GameSession,
    target: 'pa' | 'npc' | 'classifier',
  ): CognitionContext | null {
    if (!spec.cognition) return null

    const items = loadItems(spec, session)
    const formatted = formatItemList(spec, items)
    const replacements: Record<string, string> = {
      items: formatted,
      count: String(items.length),
    }

    const result: CognitionContext = {}
    if (spec.cognition.forPA && (target === 'pa')) {
      result.forPA = interpolate(spec.cognition.forPA, replacements)
    }
    if (spec.cognition.forNPC && (target === 'npc')) {
      result.forNPC = interpolate(spec.cognition.forNPC, replacements)
    }
    if (spec.cognition.forClassifier && (target === 'classifier')) {
      result.forClassifier = interpolate(spec.cognition.forClassifier, replacements)
    }

    return hasContent(result) ? result : null
  },

  buildPresentation(
    spec: BehaviorSpec,
    session: GameSession,
  ): PresentationData | null {
    if (!spec.presentation) return null

    const items = loadItems(spec, session)
    if (items.length === 0) return null

    return {
      style: spec.presentation.style,
      data: items,
      spec,
    }
  },

  activate(
    spec: BehaviorSpec,
    session: GameSession,
    context?: Record<string, unknown>,
  ): void {
    const active: ActiveBehavior = {
      specId: spec.id,
      type: 'select_one',
      state: context ?? {},
      activatedAt: Date.now(),
    }
    session.flags = { ...session.flags, activeBehavior: active }
  },

  deactivate(
    spec: BehaviorSpec,
    session: GameSession,
  ): void {
    void spec
    if (session.flags) {
      const rest = { ...session.flags }
      delete rest.activeBehavior
      session.flags = rest
    }
  },
}

// ─── Helpers ──────────────────────────────────────

function loadItems(spec: BehaviorSpec, session: GameSession): Record<string, unknown>[] {
  const dataConf = spec.presentation?.data
  if (!dataConf) return []

  const source = session.data?.[dataConf.field]
  if (!Array.isArray(source)) return []

  return source as Record<string, unknown>[]
}

function formatItemList(spec: BehaviorSpec, items: Record<string, unknown>[]): string {
  const cardTemplate = spec.presentation?.card
  if (!cardTemplate || items.length === 0) return ''

  return items.map((item, i) => {
    const title = interpolateItem(cardTemplate.title, item)
    const subtitle = cardTemplate.subtitle
      ? interpolateItem(cardTemplate.subtitle, item)
      : null
    return subtitle
      ? `${i + 1}. ${title} — ${subtitle}`
      : `${i + 1}. ${title}`
  }).join('\n')
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => vars[key] ?? match)
}

function interpolateItem(template: string, item: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const val = item[key]
    return val != null ? String(val) : match
  })
}

function hasContent(ctx: CognitionContext): boolean {
  return !!(ctx.forPA || ctx.forNPC || ctx.forClassifier)
}
