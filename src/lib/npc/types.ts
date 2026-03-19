import type { DualText, SceneAction, TurnOutcome, FCResult } from '@/lib/engine/types'

// ─── NPC Reply Result ────────────────────────────

export interface NPCReplyMeta {
  scopeAssessment: 'in_scope' | 'redirect'
}

export interface NPCReplyResult extends DualText {
  meta?: NPCReplyMeta
}

// ─── NPC Configuration ───────────────────────────

export interface NPCConfig {
  key: string
  sceneId: string
  scope: string[]
  basePrompt: string
  ownerUserId?: string
  canBePlayedByPA?: boolean
}

export interface NPCSeedData {
  key: string
  name: string
  emoji: string
  role: 'gm' | 'scene_host'
  sceneId: string | null
  accent: string
  systemPrompt: string
  scope: string[]
}

// ─── NPC Reply Context ───────────────────────────

export interface VisitorInfo {
  name?: string
  type: 'pa' | 'agent'
}

export type SceneEntryType = 'first' | 'return'

export interface NPCReplyContext {
  sceneId: string
  visitorMessage?: string
  outcome?: TurnOutcome
  sceneData?: Record<string, unknown>
  visitorInfo?: VisitorInfo
  entryType?: SceneEntryType
  isFreeChat?: boolean
  sessionContext?: string
  fcResult?: FCResult
  recentNpcMessages?: string[]
}
