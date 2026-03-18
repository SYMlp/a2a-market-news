/**
 * Conversation Guard — detects repetitive NPC responses and stale loops.
 *
 * Tracks recent NPC messages per session. When the same (or highly similar)
 * message appears REPEAT_THRESHOLD times in a row, the guard fires and
 * overrides the NPC response with a circuit-breaker message that guides
 * the player out of the dead loop.
 */

import type { GameSession, DualText } from './types'
import { persistSession } from './session'

const REPEAT_THRESHOLD = 3
const HISTORY_SIZE = 10

interface ConversationHistory {
  npcMessages: string[]
  consecutiveRepeats: number
  lastMessage: string
  guardTriggered: boolean
}

function getHistory(session: GameSession): ConversationHistory {
  const hist = session.flags?._conversationHistory as ConversationHistory | undefined
  return hist ?? {
    npcMessages: [],
    consecutiveRepeats: 0,
    lastMessage: '',
    guardTriggered: false,
  }
}

function saveHistory(session: GameSession, hist: ConversationHistory): void {
  session.flags = {
    ...session.flags,
    _conversationHistory: hist,
  }
}

function normalize(text: string): string {
  return text.replace(/\s+/g, '').replace(/[。！？，、：；""''（）\[\]【】]/g, '').slice(0, 120)
}

function isSimilar(a: string, b: string): boolean {
  if (!a || !b) return false
  const na = normalize(a)
  const nb = normalize(b)
  if (na === nb) return true
  if (na.length < 5 || nb.length < 5) return na === nb
  const shorter = na.length < nb.length ? na : nb
  const longer = na.length >= nb.length ? na : nb
  return longer.includes(shorter) || shorter.includes(longer)
}

/**
 * Record an NPC message and check for repetition.
 * Returns a circuit-breaker DualText if the guard fires, or null if OK.
 */
export function checkAndRecord(
  session: GameSession,
  npcMessage: string,
  sceneId: string,
): DualText | null {
  const hist = getHistory(session)

  hist.npcMessages.push(npcMessage)
  if (hist.npcMessages.length > HISTORY_SIZE) {
    hist.npcMessages = hist.npcMessages.slice(-HISTORY_SIZE)
  }

  if (isSimilar(npcMessage, hist.lastMessage)) {
    hist.consecutiveRepeats++
  } else {
    hist.consecutiveRepeats = 1
  }
  hist.lastMessage = npcMessage

  if (hist.consecutiveRepeats >= REPEAT_THRESHOLD && !hist.guardTriggered) {
    hist.guardTriggered = true
    saveHistory(session, hist)
    persistSession(session)

    const breakerPa = sceneId === 'lobby'
      ? '看起来我们聊了好几轮同样的话题了。要不换个方向？你可以去日报栏逛逛，或者去开发者空间看看。'
      : '我们好像兜圈子了！要不先回大厅换个话题？直接说"回大厅"就行。'

    return {
      pa: breakerPa,
      agent: `[GUARD] Conversation loop detected after ${hist.consecutiveRepeats} repeats. Circuit breaker activated.`,
    }
  }

  saveHistory(session, hist)
  persistSession(session)
  return null
}

/**
 * Reset the NPC-message guard state (call on scene transition).
 * Does NOT reset transition history — that persists across scenes.
 */
export function resetGuard(session: GameSession): void {
  const hist = getHistory(session)
  hist.consecutiveRepeats = 0
  hist.guardTriggered = false
  hist.lastMessage = ''
  saveHistory(session, hist)
}

// ─── Cross-Scene Transition Loop Detection ───────

const TRANSITION_LOOP_THRESHOLD = 2
const PATH_CYCLE_MIN_LENGTH = 3
const PATH_CYCLE_HISTORY_WINDOW = 12

/**
 * Detect a repeating path cycle of length >= 3 in a transition sequence.
 * Returns the cycle as scene IDs (e.g. ['lobby','news','dev']) or null.
 */
export function detectPathCycle(
  transitions: Array<{ from: string; to: string }>,
): string[] | null {
  if (transitions.length < PATH_CYCLE_MIN_LENGTH * 2 - 1) return null

  const recent = transitions.slice(-PATH_CYCLE_HISTORY_WINDOW)
  const scenes: string[] = [recent[0].from]
  for (const t of recent) scenes.push(t.to)

  const n = scenes.length
  for (let len = PATH_CYCLE_MIN_LENGTH; len <= Math.floor(n / 2); len++) {
    const tail = scenes.slice(n - len)
    const prev = scenes.slice(n - 2 * len, n - len)
    if (prev.length === len && tail.every((s, i) => s === prev[i])) {
      return tail
    }
  }
  return null
}

/**
 * Record a scene transition and check for dead loops.
 * Detects both A↔B ping-pong and longer path cycles (length >= 3).
 * Returns a circuit-breaker DualText if a pattern is found, or null if OK.
 */
export function recordTransitionAndCheck(
  session: GameSession,
  from: string,
  to: string,
): DualText | null {
  const history = (session.flags?.transitionHistory ?? []) as Array<{ from: string; to: string; turn: number }>
  history.push({ from, to, turn: session.globalTurn })
  if (history.length > 20) history.splice(0, history.length - 20)
  session.flags = { ...session.flags, transitionHistory: history }
  persistSession(session)

  // Check 1: A↔B ping-pong detection (existing)
  if (history.length >= TRANSITION_LOOP_THRESHOLD * 2) {
    const tail = history.slice(-TRANSITION_LOOP_THRESHOLD * 2)
    let isPingPong = true
    for (let i = 0; i < TRANSITION_LOOP_THRESHOLD * 2 - 2; i += 2) {
      if (tail[i].from !== tail[i + 2]?.from || tail[i].to !== tail[i + 2]?.to) {
        isPingPong = false
        break
      }
    }
    if (isPingPong) {
      const loopA = tail[0].from
      const loopB = tail[0].to
      return {
        pa: `我们已经在「${loopA}」和「${loopB}」之间来回跑了好几趟了。这次换个方向——你还没去过的地方或许有惊喜，也可以先离开下次再来。`,
        agent: `[GUARD] Cross-scene A↔B loop detected: ${loopA} ↔ ${loopB} repeated ${TRANSITION_LOOP_THRESHOLD} times. Breaking loop.`,
      }
    }
  }

  // Check 2: longer path cycle detection (length >= 3)
  const cycle = detectPathCycle(history)
  if (cycle) {
    const cycleLabels = cycle.join('→')
    return {
      pa: `你已经走了同样的路线了（${cycleLabels}），要不换个新方向？也可以直接离开，下次再来。`,
      agent: `[GUARD] Path cycle detected: ${cycleLabels}. Breaking loop.`,
    }
  }

  return null
}
