import type { Scene } from '@/lib/engine/types'
import { parseJSONLoose } from '@/lib/json-utils'

/**
 * @deprecated Frontend intent extraction is replaced by backend AI classifier.
 * Kept for backward compatibility; will be removed in next cleanup.
 */
export function extractValidIntents(scene: Scene): string[] {
  return scene.actions
    .filter((a) => a.actIntent)
    .map((a) => a.actIntent!)
}

/**
 * @deprecated Frontend intent→trigger mapping is replaced by backend AI classifier.
 */
export function buildIntentActionMap(scene: Scene): Record<string, string> {
  const map: Record<string, string> = {}
  for (const action of scene.actions) {
    if (action.actIntent && (action.triggers ?? []).length > 0) {
      map[action.actIntent] = (action.triggers ?? [])[0] ?? action.actIntent
    }
  }
  return map
}

export interface IntentResult {
  intent: string
  confidence: number
}

export function parseIntentResult(raw: string): IntentResult {
  try {
    const parsed = parseJSONLoose(raw) as Record<string, unknown>
    return {
      intent: String(parsed.intent ?? ''),
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
    }
  } catch {
    return { intent: '', confidence: 0 }
  }
}
