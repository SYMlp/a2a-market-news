import { describe, it, expect, vi } from 'vitest'

vi.mock('./session-context', () => ({
  persistSessionState: vi.fn(),
}))

vi.mock('./ontology', () => ({
  getHubSceneId: vi.fn().mockReturnValue('lobby'),
  getOntology: vi.fn().mockReturnValue({
    scenes: {
      lobby: { label: '大厅', exits: ['news', 'developer'] },
      news: { label: '日报栏', exits: ['lobby'] },
      developer: { label: '开发者空间', exits: ['lobby'] },
    },
  }),
  getCommunicationProtocol: vi.fn().mockReturnValue({
    guardMessages: {
      conversationLoop: {
        atHub: {
          pa: '看起来我们聊了好几轮同样的话题了。要不换个方向？你可以去{exitLabels}。',
          agent: '[GUARD] Conversation loop detected. Circuit breaker activated.',
        },
        atScene: {
          pa: '我们好像兜圈子了！要不先回{hubLabel}换个话题？直接说"回{hubLabel}"就行。',
          agent: '[GUARD] Conversation loop detected. Circuit breaker activated.',
        },
      },
      actionRepeat: {
        pa: '我们好像重复同样的操作好几次了，换个方向吧！你可以试试别的操作，或者回{hubLabel}看看其他场景。',
        agent: '[GUARD] Same action "{actionId}" repeated {count} times in scene "{sceneId}". Circuit breaker activated.',
      },
      transitionPingPong: {
        pa: '我们已经在「{loopA}」和「{loopB}」之间来回跑了好几趟了。这次换个方向——你还没去过的地方或许有惊喜，也可以先离开下次再来。',
        agent: '[GUARD] Cross-scene A↔B loop detected: {loopA} ↔ {loopB} repeated {count} times. Breaking loop.',
      },
      pathCycle: {
        pa: '你已经走了同样的路线了（{cycleLabels}），要不换个新方向？也可以直接离开，下次再来。',
        agent: '[GUARD] Path cycle detected: {cycleLabels}. Breaking loop.',
      },
    },
  }),
  getSceneLabel: vi.fn().mockImplementation((id: string) => {
    const labels: Record<string, string> = { lobby: '大厅', news: '日报栏', developer: '开发者空间' }
    return labels[id] ?? id
  }),
}))

import {
  checkAndRecord,
  recordPaMessage,
  getPaHistory,
  resetGuard,
  checkActionRepeat,
  detectPathCycle,
  recordTransitionAndCheck,
} from './conversation-guard'
import type { GameSession } from './types'

function makeSession(overrides: Partial<GameSession> = {}): GameSession {
  return {
    id: 'test-session',
    currentScene: 'news',
    round: 0,
    globalTurn: 0,
    mode: 'manual',
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
    flags: {},
    ...overrides,
  }
}

// ═══════════════════════════════════════════════════
// Mode 1: NPC Message Repetition
// ═══════════════════════════════════════════════════

describe('checkAndRecord — NPC message repetition', () => {
  it('returns null when messages are different', () => {
    const session = makeSession()
    expect(checkAndRecord(session, 'message A', 'news')).toBeNull()
    expect(checkAndRecord(session, 'message B', 'news')).toBeNull()
    expect(checkAndRecord(session, 'message C', 'news')).toBeNull()
  })

  it('fires circuit breaker on 3 consecutive identical messages', () => {
    const session = makeSession()
    expect(checkAndRecord(session, 'same reply', 'news')).toBeNull()
    expect(checkAndRecord(session, 'same reply', 'news')).toBeNull()
    const result = checkAndRecord(session, 'same reply', 'news')

    expect(result).not.toBeNull()
    expect(result!.agent).toContain('[GUARD]')
    expect(result!.pa).toContain('回大厅')
  })

  it('fires with lobby-specific message when sceneId is lobby', () => {
    const session = makeSession({ currentScene: 'lobby' })
    checkAndRecord(session, 'same', 'lobby')
    checkAndRecord(session, 'same', 'lobby')
    const result = checkAndRecord(session, 'same', 'lobby')

    expect(result).not.toBeNull()
    expect(result!.pa).toContain('日报栏')
    expect(result!.pa).not.toContain('回大厅')
  })

  it('detects similar messages (with whitespace/punctuation differences)', () => {
    const session = makeSession()
    checkAndRecord(session, '欢迎来到日报栏！', 'news')
    checkAndRecord(session, '欢迎来到日报栏', 'news')
    const result = checkAndRecord(session, '  欢迎来到 日报栏  ', 'news')

    expect(result).not.toBeNull()
  })

  it('resets counter when a different message appears', () => {
    const session = makeSession()
    checkAndRecord(session, 'same', 'news')
    checkAndRecord(session, 'same', 'news')
    checkAndRecord(session, 'different', 'news')
    const result = checkAndRecord(session, 'same', 'news')

    expect(result).toBeNull()
  })

  it('caps history to HISTORY_SIZE entries', () => {
    const session = makeSession()
    for (let i = 0; i < 15; i++) {
      checkAndRecord(session, `msg-${i}`, 'news')
    }
    const hist = session.flags?._conversationHistory as { npcMessages: string[] }
    expect(hist.npcMessages.length).toBeLessThanOrEqual(10)
  })
})

describe('resetGuard', () => {
  it('resets NPC message history and guard state', () => {
    const session = makeSession()
    checkAndRecord(session, 'same', 'news')
    checkAndRecord(session, 'same', 'news')

    resetGuard(session)

    const result = checkAndRecord(session, 'same', 'news')
    expect(result).toBeNull()
  })
})

// ═══════════════════════════════════════════════════
// PA Message History
// ═══════════════════════════════════════════════════

describe('recordPaMessage / getPaHistory', () => {
  it('records and retrieves PA messages', () => {
    const session = makeSession()
    recordPaMessage(session, 'hello')
    recordPaMessage(session, 'how are you')
    recordPaMessage(session, 'goodbye')

    expect(getPaHistory(session, 2)).toEqual(['how are you', 'goodbye'])
  })

  it('returns empty array when no messages recorded', () => {
    const session = makeSession()
    expect(getPaHistory(session)).toEqual([])
  })

  it('caps PA history to HISTORY_SIZE', () => {
    const session = makeSession()
    for (let i = 0; i < 15; i++) {
      recordPaMessage(session, `pa-${i}`)
    }
    const hist = session.flags?._conversationHistory as { paMessages: string[] }
    expect(hist.paMessages.length).toBeLessThanOrEqual(10)
  })
})

// ═══════════════════════════════════════════════════
// Mode 4: Same-Scene Action Repeat
// ═══════════════════════════════════════════════════

describe('checkActionRepeat — same-scene action repeat', () => {
  it('returns null for first two repeats', () => {
    const session = makeSession()
    expect(checkActionRepeat(session, 'news', 'GM.assignMission')).toBeNull()
    expect(checkActionRepeat(session, 'news', 'GM.assignMission')).toBeNull()
  })

  it('fires circuit breaker on 3rd repeat of same action in same scene', () => {
    const session = makeSession()
    checkActionRepeat(session, 'news', 'GM.assignMission')
    checkActionRepeat(session, 'news', 'GM.assignMission')
    const result = checkActionRepeat(session, 'news', 'GM.assignMission')

    expect(result).not.toBeNull()
    expect(result!.agent).toContain('[GUARD]')
    expect(result!.agent).toContain('GM.assignMission')
    expect(result!.agent).toContain('3 times')
  })

  it('resets counter when action changes', () => {
    const session = makeSession()
    checkActionRepeat(session, 'news', 'GM.assignMission')
    checkActionRepeat(session, 'news', 'GM.assignMission')
    checkActionRepeat(session, 'news', 'GM.differentAction')
    const result = checkActionRepeat(session, 'news', 'GM.assignMission')

    expect(result).toBeNull()
  })

  it('resets counter when scene changes', () => {
    const session = makeSession()
    checkActionRepeat(session, 'news', 'GM.assignMission')
    checkActionRepeat(session, 'news', 'GM.assignMission')
    checkActionRepeat(session, 'developer', 'GM.assignMission')
    const result = checkActionRepeat(session, 'news', 'GM.assignMission')

    expect(result).toBeNull()
  })
})

// ═══════════════════════════════════════════════════
// Mode 2 & 3: Cross-Scene Transition Loop Detection
// ═══════════════════════════════════════════════════

describe('detectPathCycle — pure function', () => {
  it('returns null for short transition history', () => {
    const transitions = [
      { from: 'lobby', to: 'news' },
      { from: 'news', to: 'lobby' },
    ]
    expect(detectPathCycle(transitions)).toBeNull()
  })

  it('detects a length-3 path cycle', () => {
    const transitions = [
      { from: 'lobby', to: 'news' },
      { from: 'news', to: 'developer' },
      { from: 'developer', to: 'lobby' },
      { from: 'lobby', to: 'news' },
      { from: 'news', to: 'developer' },
    ]
    const cycle = detectPathCycle(transitions)
    expect(cycle).toEqual(['lobby', 'news', 'developer'])
  })

  it('returns null when no cycle exists', () => {
    const transitions = [
      { from: 'lobby', to: 'news' },
      { from: 'news', to: 'lobby' },
      { from: 'lobby', to: 'developer' },
      { from: 'developer', to: 'lobby' },
      { from: 'lobby', to: 'news' },
    ]
    expect(detectPathCycle(transitions)).toBeNull()
  })
})

describe('recordTransitionAndCheck — A↔B ping-pong', () => {
  it('returns null for non-repeating transitions', () => {
    const session = makeSession()
    expect(recordTransitionAndCheck(session, 'lobby', 'news')).toBeNull()
    expect(recordTransitionAndCheck(session, 'news', 'developer')).toBeNull()
  })

  it('detects A↔B ping-pong', () => {
    const session = makeSession()
    recordTransitionAndCheck(session, 'lobby', 'news')
    recordTransitionAndCheck(session, 'news', 'lobby')
    recordTransitionAndCheck(session, 'lobby', 'news')
    const result = recordTransitionAndCheck(session, 'news', 'lobby')

    expect(result).not.toBeNull()
    expect(result!.agent).toContain('[GUARD]')
    expect(result!.agent).toContain('A↔B loop')
  })

  it('preserves transition history across calls (does not reset on scene change)', () => {
    const session = makeSession()
    recordTransitionAndCheck(session, 'lobby', 'news')
    recordTransitionAndCheck(session, 'news', 'lobby')

    const history = session.flags?.transitionHistory as Array<{ from: string; to: string }>
    expect(history).toHaveLength(2)
  })

  it('caps transition history to 20 entries', () => {
    const session = makeSession()
    for (let i = 0; i < 25; i++) {
      recordTransitionAndCheck(session, `scene-${i}`, `scene-${i + 1}`)
    }
    const history = session.flags?.transitionHistory as unknown[]
    expect(history.length).toBeLessThanOrEqual(20)
  })
})
