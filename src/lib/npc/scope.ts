import type { NPCConfig, NPCSeedData } from './types'
import type { DualText } from '@/lib/engine/types'
import { loadAllNPCSpecs } from './npc-loader'

/**
 * Checks whether a topic falls within an NPC's defined scope.
 * Empty scope means no restriction (NPC handles everything).
 */
export function isWithinScope(
  npc: Pick<NPCConfig | NPCSeedData, 'scope'>,
  topic: string,
): boolean {
  if (!npc.scope.length) return true
  const lower = topic.toLowerCase()
  return npc.scope.some(kw => lower.includes(kw.toLowerCase()))
}

/**
 * Builds a scope constraint string for injection into NPC system prompts.
 * Returns empty string when scope is unrestricted.
 */
export function buildScopeConstraint(scope: string[]): string {
  if (!scope.length) return ''
  return `你的专长领域：${scope.join('、')}。如果访客的话题超出你的领域，建议引导他们去合适的场景。`
}

// ─── Runtime Scope Check & Redirect ─────────────

export interface ScopeCheckResult {
  inScope: boolean
  redirectMessage?: DualText
}

const REDIRECT_MESSAGES: Record<string, DualText> = {
  news: {
    pa: '这个超出我的范围了，建议回大厅找灵枢兔帮你导航～',
    agent: 'Out of scope. Redirecting to lobby navigator.',
  },
  developer: {
    pa: '这块不是我的专长，回大厅问问灵枢兔吧～',
    agent: 'Out of scope. Redirecting to lobby navigator.',
  },
}

const DEFAULT_REDIRECT: DualText = {
  pa: '这个不在我的职责范围内，建议回大厅找灵枢兔帮你导航～',
  agent: 'Out of scope. Redirecting to lobby navigator.',
}

/**
 * Runtime scope gate: checks visitor message against NPC scope.
 * Returns inScope=true if the NPC can handle it, otherwise provides
 * a redirect message pointing the visitor back to the lobby navigator.
 */
export function checkScopeAndRedirect(
  npcKey: string,
  visitorMessage: string,
  sceneId: string,
): ScopeCheckResult {
  const seed = loadAllNPCSpecs().find(s => s.key === npcKey)
  if (!seed || !seed.scope.length) return { inScope: true }

  if (isWithinScope(seed, visitorMessage)) {
    return { inScope: true }
  }

  return {
    inScope: false,
    redirectMessage: REDIRECT_MESSAGES[sceneId] ?? DEFAULT_REDIRECT,
  }
}

// ─── PA-as-NPC extension point ───────────────────
// Future: when a PA takes over an NPC role, scope determines
// which responsibilities are mandatory (in-scope) vs. freestyle.

export function canPABeNPC(npc: Pick<NPCConfig, 'canBePlayedByPA'>): boolean {
  return npc.canBePlayedByPA ?? false
}
