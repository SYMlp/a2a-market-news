/**
 * PA auto-loop control logic.
 * Extracted from lobby/page.tsx for reuse and testability.
 *
 * Flow: GM message → PA responds (via paRespondApi) → raw PA text sent to GM
 * (backend AI classifier handles action resolution) → NPC responds or scene transition.
 */

export interface AutoLoopStepOptions {
  /** Last NPC/GM message shown to PA */
  lastAgentMsg: string
  /** Call PA to respond to GM message */
  paRespondApi: (gmMessage: string) => Promise<{
    success: boolean
    paResponse: string
  } | null>
  /** Send PA message to GM/NPC. Backend handles action classification. */
  sendMessageApi: (text: string) => Promise<{
    success: boolean
    message?: { pa: string }
    sceneTransition?: { from: string; to: string }
  } | null>
  /** Check if loop should stop (e.g. user paused or switched mode) */
  shouldStop: () => boolean
  /** Called when PA has responded (before sending to GM) */
  onPaResponse?: (paResponse: string) => void
  /** Called when scene transition is needed */
  onSceneTransition: (tr: { from: string; to: string }) => Promise<void>
  /** Called when NPC responds (no transition) */
  onNpcMessage?: (msg: string) => void
  /** Typing delay after PA speaks (ms) */
  speakDelayMs?: (paResponse: string) => number
  /** Called when loop guard detects repeated NPC messages */
  onLoopDetected?: () => void
  /** Recent NPC messages for client-side repetition tracking */
  recentNpcMessages?: string[]
}

export type AutoLoopStepResult =
  | { type: 'sceneTransition'; transition: { from: string; to: string } }
  | { type: 'continue'; npcMessage: string }
  | { type: 'stopped' }
  | { type: 'error'; reason: string }

/**
 * Run one step of the auto-loop: PA responds to GM → send to GM → handle result.
 */
export async function runAutoLoopStep(
  options: AutoLoopStepOptions
): Promise<AutoLoopStepResult> {
  const {
    lastAgentMsg,
    paRespondApi,
    sendMessageApi,
    shouldStop,
    onPaResponse,
    onSceneTransition,
    onNpcMessage,
    speakDelayMs = (text) => Math.min(text.length * 28, 2000) + 400,
  } = options

  if (!lastAgentMsg) {
    return { type: 'error', reason: 'no last agent message' }
  }

  const paResult = await paRespondApi(lastAgentMsg)
  if (shouldStop()) return { type: 'stopped' }
  if (!paResult || !paResult.success) {
    return { type: 'error', reason: 'pa respond failed' }
  }

  const paResponse = paResult.paResponse
  onPaResponse?.(paResponse)

  const delay = speakDelayMs(paResponse)
  await new Promise((r) => setTimeout(r, delay))
  if (shouldStop()) return { type: 'stopped' }

  const gmResult = await sendMessageApi(paResponse)
  if (shouldStop()) return { type: 'stopped' }
  if (!gmResult || !gmResult.success) {
    return { type: 'error', reason: 'send message failed' }
  }

  if (gmResult.sceneTransition) {
    const farewellMsg = gmResult.message?.pa || ''
    if (farewellMsg) {
      onNpcMessage?.(farewellMsg)
      const farewellDelay = speakDelayMs(farewellMsg)
      await new Promise((r) => setTimeout(r, farewellDelay))
      if (shouldStop()) return { type: 'stopped' }
    }
    await onSceneTransition(gmResult.sceneTransition)
    return {
      type: 'sceneTransition',
      transition: gmResult.sceneTransition,
    }
  }

  const npcMessage = gmResult.message?.pa ?? ''
  onNpcMessage?.(npcMessage)

  if (options.recentNpcMessages && npcMessage) {
    const normalized = npcMessage.replace(/\s+/g, '').slice(0, 80)
    const recent = options.recentNpcMessages.map(m => m.replace(/\s+/g, '').slice(0, 80))
    const repeats = recent.filter(m => m === normalized).length
    if (repeats >= 2) {
      options.onLoopDetected?.()
      return { type: 'error', reason: 'loop detected: repeated NPC messages' }
    }
  }

  return { type: 'continue', npcMessage }
}
