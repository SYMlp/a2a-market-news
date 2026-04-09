import { describe, it, expect, vi } from 'vitest'

vi.mock('./ontology', () => ({
  getHubSceneId: vi.fn().mockReturnValue('lobby'),
  getSceneLabel: vi.fn().mockImplementation((id: string) => {
    const labels: Record<string, string> = { lobby: '大厅', news: '日报栏', developer: '开发者空间' }
    return labels[id] ?? id
  }),
}))

vi.mock('./session-context', () => ({
  persistSessionState: vi.fn(),
  checkPrecondition: vi.fn().mockReturnValue(true),
  clearSceneScopedFlags: vi.fn(),
  getReturnContext: vi.fn().mockReturnValue(null),
}))

vi.mock('./conversation-guard', () => ({
  checkAndRecord: vi.fn().mockReturnValue(null),
  resetGuard: vi.fn(),
}))

vi.mock('@/lib/behavior-engine', () => ({
  activateBehavior: vi.fn(),
  deactivateBehavior: vi.fn(),
  getBehaviorsForScene: vi.fn().mockReturnValue([]),
}))

import { resolveTurn, presentScene, applyResult, processTurn } from './game-loop'
import { getHubSceneId } from './ontology'
import type { GameSession, PlayerTurn, TurnOutcome } from './types'

function makeSession(overrides: Partial<GameSession> = {}): GameSession {
  return {
    id: 'test-session',
    currentScene: 'lobby',
    round: 0,
    globalTurn: 0,
    mode: 'manual',
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
    ...overrides,
  }
}

// ═══════════════════════════════════════════════════
// resolveTurn — L1 + L2 binary decision tree
// ═══════════════════════════════════════════════════

describe('resolveTurn', () => {
  it('REST resolves to stay with delay-capable message', () => {
    const session = makeSession()
    const turn: PlayerTurn = { type: 'rest', seconds: 10 }
    const out = resolveTurn(session, turn)
    expect(out.type).toBe('stay')
    if (out.type === 'stay') {
      expect(out.effect.functionCall.name).toBe('GM.rest')
    }
  })

  it('_back always moves to hub scene', () => {
    const session = makeSession({ currentScene: 'news' })
    const out = resolveTurn(session, { type: 'act', actionId: '_back' })
    expect(out.type).toBe('move')
    if (out.type === 'move') {
      expect(out.target).toBe(getHubSceneId())
    }
  })

  it('unknown action id falls back to scene fallback stay', () => {
    const session = makeSession()
    const out = resolveTurn(session, { type: 'act', actionId: 'definitely_missing_action_xyz' })
    expect(out.type).toBe('stay')
    if (out.type === 'stay') {
      expect(out.effect.functionCall.name).toBe('GM.fallback')
    }
  })

  it('_help resolves to stay with GM.help function call', () => {
    const session = makeSession()
    const out = resolveTurn(session, { type: 'act', actionId: '_help' })
    expect(out.type).toBe('stay')
    if (out.type === 'stay') {
      expect(out.effect.functionCall.name).toBe('GM.help')
      expect(out.effect.refreshData).toBe(false)
    }
  })

  it('known STAY action returns stay with correct function call', () => {
    const session = makeSession({ currentScene: 'lobby' })
    const out = resolveTurn(session, { type: 'act', actionId: 'leave_platform' })
    expect(out.type).toBe('stay')
    if (out.type === 'stay') {
      expect(out.effect.functionCall.name).toBe('GM.leavePlatform')
    }
  })

  it('known MOVE action returns move with correct target', () => {
    const session = makeSession({ currentScene: 'lobby' })
    const out = resolveTurn(session, { type: 'act', actionId: 'go_news' })
    expect(out.type).toBe('move')
    if (out.type === 'move') {
      expect(out.target).toBe('news')
      expect(out.transitionType).toBe('enter_space')
    }
  })

  it('every outcome has DualText message with pa and agent', () => {
    const session = makeSession()
    const outcomes = [
      resolveTurn(session, { type: 'rest', seconds: 5 }),
      resolveTurn(session, { type: 'act', actionId: '_back' }),
      resolveTurn(session, { type: 'act', actionId: '_help' }),
      resolveTurn(session, { type: 'act', actionId: 'no_such_action' }),
    ]
    for (const out of outcomes) {
      expect(out.message).toHaveProperty('pa')
      expect(out.message).toHaveProperty('agent')
      expect(typeof out.message.pa).toBe('string')
      expect(typeof out.message.agent).toBe('string')
    }
  })
})

// ═══════════════════════════════════════════════════
// presentScene
// ═══════════════════════════════════════════════════

describe('presentScene', () => {
  it('returns lobby presentation with actions', () => {
    const session = makeSession({ currentScene: 'lobby' })
    const pres = presentScene(session)
    expect(pres.sceneId).toBe('lobby')
    expect(pres.actions.length).toBeGreaterThan(0)
    expect(pres.opening.pa).toBeTruthy()
  })

  it('returns news scene presentation', () => {
    const session = makeSession({ currentScene: 'news' })
    const pres = presentScene(session)
    expect(pres.sceneId).toBe('news')
    expect(pres.actions.length).toBeGreaterThan(0)
  })

  it('includes meta actions: rest and help for all scenes', () => {
    const session = makeSession({ currentScene: 'lobby' })
    const pres = presentScene(session)
    expect(pres.meta).toContain('rest')
    expect(pres.meta).toContain('help')
  })

  it('includes back meta action for non-lobby scenes', () => {
    const session = makeSession({ currentScene: 'news' })
    const pres = presentScene(session)
    expect(pres.meta).toContain('back')
  })

  it('does NOT include back meta action for hub scene', () => {
    const session = makeSession({ currentScene: 'lobby' })
    const pres = presentScene(session)
    expect(pres.meta).not.toContain('back')
  })

  it('action slots have required fields', () => {
    const session = makeSession({ currentScene: 'lobby' })
    const pres = presentScene(session)
    for (const slot of pres.actions) {
      expect(slot).toHaveProperty('id')
      expect(slot).toHaveProperty('label')
      expect(slot).toHaveProperty('outcome')
      expect(typeof slot.available).toBe('boolean')
    }
  })
})

// ═══════════════════════════════════════════════════
// applyResult — state mutation
// ═══════════════════════════════════════════════════

describe('applyResult', () => {
  it('increments globalTurn on any outcome', () => {
    const session = makeSession({ globalTurn: 5 })
    const outcome: TurnOutcome = {
      type: 'stay',
      effect: { functionCall: { name: 'GM.rest', args: {} } },
      message: { pa: '', agent: '' },
    }
    applyResult(session, outcome)
    expect(session.globalTurn).toBe(6)
  })

  it('increments round on STAY outcome', () => {
    const session = makeSession({ round: 2 })
    const outcome: TurnOutcome = {
      type: 'stay',
      effect: { functionCall: { name: 'GM.rest', args: {} } },
      message: { pa: '', agent: '' },
    }
    applyResult(session, outcome)
    expect(session.round).toBe(3)
  })

  it('resets round to 0 and changes scene on MOVE outcome', () => {
    const session = makeSession({ currentScene: 'lobby', round: 5 })
    const outcome: TurnOutcome = {
      type: 'move',
      target: 'news',
      transitionType: 'enter_space',
      message: { pa: '', agent: '' },
    }
    applyResult(session, outcome)
    expect(session.currentScene).toBe('news')
    expect(session.round).toBe(0)
  })

  it('merges dataUpdate into session.data on STAY', () => {
    const session = makeSession({ data: { existing: true } } as Partial<GameSession>)
    const outcome: TurnOutcome = {
      type: 'stay',
      effect: {
        functionCall: { name: 'GM.test', args: {} },
        dataUpdate: { newField: 'value' },
      },
      message: { pa: '', agent: '' },
    }
    applyResult(session, outcome)
    expect(session.data).toEqual({ existing: true, newField: 'value' })
  })

  it('updates lastActiveAt timestamp', () => {
    const session = makeSession({ lastActiveAt: 0 })
    const outcome: TurnOutcome = {
      type: 'stay',
      effect: { functionCall: { name: 'GM.rest', args: {} } },
      message: { pa: '', agent: '' },
    }
    applyResult(session, outcome)
    expect(session.lastActiveAt).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════
// processTurn — full 4-stage chain
// ═══════════════════════════════════════════════════

describe('processTurn', () => {
  it('chains resolve + apply + present for REST turn', () => {
    const session = makeSession({ globalTurn: 0 })
    const result = processTurn(session, { type: 'rest', seconds: 5 })

    expect(result.sessionId).toBe('test-session')
    expect(result.scene.id).toBe('lobby')
    expect(result.message.pa).toBeTruthy()
    expect(result.actions.length).toBeGreaterThan(0)
    expect(result.outcome).toBeDefined()
    expect(result.outcome?.type).toBe('stay')
    expect(result.outcome?.functionCall?.name).toBe('GM.rest')
    expect(result.delay).toBe(5000)
    expect(session.globalTurn).toBe(1)
  })

  it('chains resolve + apply + present for MOVE turn', () => {
    const session = makeSession({ currentScene: 'lobby', globalTurn: 0 })
    const result = processTurn(session, { type: 'act', actionId: 'go_news' })

    expect(result.outcome).toBeDefined()
    expect(result.outcome?.type).toBe('move')
    expect(result.outcome?.transition?.from).toBe('lobby')
    expect(result.outcome?.transition?.to).toBe('news')
    expect(session.currentScene).toBe('news')
    expect(session.round).toBe(0)
    expect(session.globalTurn).toBe(1)
  })

  it('does not set delay for non-rest turns', () => {
    const session = makeSession()
    const result = processTurn(session, { type: 'act', actionId: '_help' })
    expect(result.delay).toBeUndefined()
  })

  it('returns presentation for the new scene after MOVE', () => {
    const session = makeSession({ currentScene: 'lobby' })
    const result = processTurn(session, { type: 'act', actionId: 'go_news' })

    expect(result.scene.id).toBe('news')
    expect(result.actions.length).toBeGreaterThan(0)
  })
})
