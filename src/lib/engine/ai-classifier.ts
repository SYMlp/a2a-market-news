/**
 * AI Action Classifier — replaces keyword matching as primary action resolution.
 *
 * Priority: cache → AI classification → keyword fallback (only when AI unavailable).
 * AI receives full scene context (actions + other scenes) so it can correctly
 * route cross-scene intents (e.g. "注册" in news → back_lobby, not experience).
 */

import type { Scene, SceneAction, GameSession } from './types'
import { matchAction } from './match'
import { listScenes } from '@/lib/scenes'
import { getCommunicationProtocol } from './ontology'
import { buildSessionContextForClassifier, buildActionConstraints } from './session-context'
import { parseJSONLoose } from '@/lib/json-utils'
import { MODEL_FOR } from '@/lib/model-config'
import { rootLogger } from '@/lib/logger'

const classifierLog = rootLogger.child({ component: 'AIClassifier' })

// ─── Cache ───────────────────────────────────────

const cache = new Map<string, { actionId: string | null; confidence: number; ts: number }>()
const CACHE_TTL = 5 * 60 * 1000
const MAX_CACHE_SIZE = 200
const AI_TIMEOUT_MS = 8_000
const CONFIDENCE_THRESHOLD = 0.7

function cacheKey(sceneId: string, msg: string): string {
  return `${sceneId}:${msg.trim().slice(0, 200).toLowerCase()}`
}

function pruneCache(): void {
  if (cache.size <= MAX_CACHE_SIZE) return
  const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)
  for (const [k] of oldest.slice(0, oldest.length - MAX_CACHE_SIZE)) cache.delete(k)
}

// ─── Prompt ──────────────────────────────────────

function describeActions(actions: SceneAction[]): string {
  const config = getCommunicationProtocol().classifierConfig
  return actions.map(a => {
    const tag = a.outcome === 'move' ? config.actionTagMove : config.actionTagStay
    return `- [${a.id}] ${a.label.pa}（${tag}）intent: ${a.actIntent}`
  }).join('\n')
}

function describeOtherScenes(currentId: string): string {
  return listScenes()
    .filter(s => s.id !== currentId)
    .map(s => `- ${s.theme.label}（${s.id}）`)
    .join('\n')
}

function buildPayload(scene: Scene, message: string, session?: GameSession): { message: string; actionControl: string } {
  const config = getCommunicationProtocol().classifierConfig
  const sessionContext = session
    ? `\n\n${buildSessionContextForClassifier(session, scene.actions)}`
    : ''

  const rulesText = config.rules.map(r => `- ${r}`).join('\n')

  const actionControl = config.promptTemplate
    .replace('{sceneLabel}', scene.theme.label)
    .replace('{actions}', describeActions(scene.actions))
    .replace('{otherScenes}', describeOtherScenes(scene.id))
    .replace('{sessionContext}', sessionContext)
    .replace('{rules}', rulesText)

  return { message, actionControl }
}

// ─── Classifier ──────────────────────────────────

export interface ClassifyResult {
  actionId: string | null
  confidence: number
  source: 'ai' | 'keyword' | 'cache'
}

export async function classifyAction(options: {
  scene: Scene
  message: string
  accessToken?: string
  session?: GameSession
}): Promise<ClassifyResult> {
  const { scene, message, accessToken, session } = options

  const constraints = session
    ? buildActionConstraints(scene.actions, session)
    : undefined
  const gatedIds = new Set(
    constraints?.filter(c => !c.available).map(c => c.actionId) ?? [],
  )

  const key = cacheKey(scene.id, message)
  const hit = cache.get(key)
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    const cachedId = hit.actionId && !gatedIds.has(hit.actionId) ? hit.actionId : null
    return { actionId: cachedId, confidence: hit.confidence, source: 'cache' }
  }

  if (accessToken) {
    try {
      const { callSecondMeStream } = await import('@/lib/pa-actions')
      const payload = buildPayload(scene, message, session)

      const raw = await Promise.race([
        callSecondMeStream('/api/secondme/act/stream', accessToken, { ...payload, model: MODEL_FOR.actionClassify }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('classifier timeout')), AI_TIMEOUT_MS),
        ),
      ])

      const parsed = parseJSONLoose(raw) as Record<string, unknown>
      const rawId = String(parsed.actionId || '')
      const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0
      const valid = rawId && scene.actions.some(a => a.id === rawId) && !gatedIds.has(rawId)
      const actionId = valid ? rawId : null

      if (confidence < CONFIDENCE_THRESHOLD) {
        const kwMatch = matchAction(scene.actions, message)
        const kwId = kwMatch && !gatedIds.has(kwMatch.id) ? kwMatch.id : null
        if (kwId && kwId !== actionId) {
          classifierLog.info(
            { confidence, actionId, keywordOverride: kwId },
            'AI low confidence; keyword override',
          )
          cache.set(key, { actionId: kwId, confidence: 0.6, ts: Date.now() })
          pruneCache()
          return { actionId: kwId, confidence: 0.6, source: 'keyword' }
        }
      }

      cache.set(key, { actionId, confidence, ts: Date.now() })
      pruneCache()
      return { actionId, confidence, source: 'ai' }
    } catch (e) {
      classifierLog.warn(
        { err: e instanceof Error ? e.message : String(e) },
        'AI classifier fallback to keyword',
      )
    }
  }

  const matched = matchAction(scene.actions, message)
  const keywordId = matched && !gatedIds.has(matched.id) ? matched.id : null
  const result: ClassifyResult = {
    actionId: keywordId,
    confidence: keywordId ? 0.5 : 0,
    source: 'keyword',
  }
  cache.set(key, { actionId: result.actionId, confidence: result.confidence, ts: Date.now() })
  pruneCache()
  return result
}

export function clearClassifierCache(): void {
  cache.clear()
}
