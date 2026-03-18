/**
 * SecondMe LLM model configuration.
 *
 * Only two models are available on the platform (tested 2026-03-17):
 *   - claude-sonnet-4-5: higher quality, ~6s latency
 *   - gemini-2.0-flash:  lower latency (~2s), cleaner JSON output
 *
 * Strategy: sonnet for user-facing dialogue quality, flash for structured
 * outputs and speed-sensitive loops.
 */

export const MODEL = {
  QUALITY: 'anthropic/claude-sonnet-4-5',
  FAST: 'google_ai_studio/gemini-2.0-flash',
} as const

export type ModelId = (typeof MODEL)[keyof typeof MODEL]

/**
 * Recommended model per call purpose.
 * Centralized here so tuning is a one-line change.
 */
export const MODEL_FOR = {
  npcDialogue: MODEL.QUALITY,
  paFormulateAdvisor: MODEL.QUALITY,
  paFormulateAuto: MODEL.FAST,
  intentExtract: MODEL.FAST,
  actionClassify: MODEL.FAST,
  paReview: MODEL.FAST,
  paVote: MODEL.FAST,
  paDiscuss: MODEL.FAST,
  paDiscover: MODEL.FAST,
  paDailyReport: MODEL.FAST,
} as const satisfies Record<string, ModelId>
