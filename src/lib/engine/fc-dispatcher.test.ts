import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./ontology', () => ({
  getOperationalOntology: vi.fn(),
}))

vi.mock('@/lib/subflow/router', () => ({
  activateSubFlowFromSpec: vi.fn(),
}))

vi.mock('@/lib/component-runtime/handler-registry', () => ({
  invokeEffect: vi.fn(),
}))

vi.mock('@/lib/behavior-engine', () => ({
  activateBehavior: vi.fn(),
  getBehaviorByTrigger: vi.fn().mockReturnValue(null),
}))

vi.mock('./session-context', () => ({
  checkPrecondition: vi.fn().mockReturnValue(true),
}))

import { dispatchFC, type FCUserContext } from './fc-dispatcher'
import { getOperationalOntology } from './ontology'
import { activateSubFlowFromSpec } from '@/lib/subflow/router'
import { invokeEffect } from '@/lib/component-runtime/handler-registry'
import { activateBehavior } from '@/lib/behavior-engine'
import type { GameSession, GMResponse } from './types'

const mockGetOntology = vi.mocked(getOperationalOntology)
const mockActivateSubFlow = vi.mocked(activateSubFlowFromSpec)
const mockInvokeEffect = vi.mocked(invokeEffect)
const mockActivateBehavior = vi.mocked(activateBehavior)

function makeSession(overrides: Partial<GameSession> = {}): GameSession {
  return {
    id: 'test',
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

function makeResponse(): GMResponse {
  return {
    message: { pa: 'test', agent: 'test' },
    currentScene: 'news',
    sessionId: 'test',
    availableActions: [],
  }
}

const testUser: FCUserContext = {
  id: 'u1',
  secondmeUserId: 'sm-u1',
  name: 'TestUser',
}

beforeEach(() => vi.clearAllMocks())

// ═══════════════════════════════════════════════════
// No execution config → skipped
// ═══════════════════════════════════════════════════

describe('dispatchFC — no ontology entry', () => {
  it('returns skipped when FC has no ontology entry', async () => {
    mockGetOntology.mockReturnValue({ functionCalls: {} } as never)

    const result = await dispatchFC(makeSession(), makeResponse(), 'GM.unknown', 'msg', testUser)

    expect(result.status).toBe('skipped')
    expect(result.detail).toContain('No execution config')
  })

  it('returns skipped when entry exists but has no execution field', async () => {
    mockGetOntology.mockReturnValue({
      functionCalls: { 'GM.test': { label: 'Test' } },
    } as never)

    const result = await dispatchFC(makeSession(), makeResponse(), 'GM.test', 'msg', testUser)

    expect(result.status).toBe('skipped')
  })
})

// ═══════════════════════════════════════════════════
// Builtin type
// ═══════════════════════════════════════════════════

describe('dispatchFC — builtin type', () => {
  it('handles passthrough builtin', async () => {
    mockGetOntology.mockReturnValue({
      functionCalls: {
        'GM.rest': { execution: { type: 'builtin', handler: 'passthrough', detail: 'dataLoader 已加载' } },
      },
    } as never)

    const result = await dispatchFC(makeSession(), makeResponse(), 'GM.rest', 'msg', testUser)

    expect(result.status).toBe('executed')
    expect(result.detail).toContain('dataLoader')
  })

  it('handles navigation builtin (no specific handler)', async () => {
    mockGetOntology.mockReturnValue({
      functionCalls: {
        'GM.navigate': { execution: { type: 'builtin' } },
      },
    } as never)

    const result = await dispatchFC(makeSession(), makeResponse(), 'GM.navigate', 'msg', testUser)

    expect(result.status).toBe('executed')
  })
})

// ═══════════════════════════════════════════════════
// SubFlow type
// ═══════════════════════════════════════════════════

describe('dispatchFC — subflow type', () => {
  it('activates subflow via spec name', async () => {
    mockGetOntology.mockReturnValue({
      functionCalls: {
        'GM.startProfile': {
          execution: { type: 'subflow', specName: 'profile-subflow', detail: 'Profile activated' },
        },
      },
    } as never)

    const result = await dispatchFC(makeSession(), makeResponse(), 'GM.startProfile', 'msg', testUser)

    expect(result.status).toBe('executed')
    expect(result.detail).toBe('Profile activated')
    expect(mockActivateSubFlow).toHaveBeenCalledWith(
      expect.anything(),
      'profile-subflow',
      expect.any(Object),
    )
  })

  it('uses context builder for GM.startRegistration and passes context to SubFlow', async () => {
    mockGetOntology.mockReturnValue({
      functionCalls: {
        'GM.startRegistration': {
          execution: { type: 'subflow', specName: 'register', detail: 'Registration started', contextBuilder: 'fc.buildContext.registration' },
        },
      },
    } as never)
    mockInvokeEffect.mockResolvedValueOnce({
      context: { developerId: 'u1', existingApps: [] },
    })

    const session = makeSession()
    const result = await dispatchFC(session, makeResponse(), 'GM.startRegistration', 'msg', testUser)

    expect(result.status).toBe('executed')
    expect(mockInvokeEffect).toHaveBeenCalledWith(
      'fc.buildContext.registration',
      {},
      expect.objectContaining({ session, user: testUser }),
    )
    expect(mockActivateSubFlow).toHaveBeenCalledWith(
      session,
      'register',
      { developerId: 'u1', existingApps: [] },
    )
  })

  it('returns early when context builder signals earlyReturn', async () => {
    mockGetOntology.mockReturnValue({
      functionCalls: {
        'GM.startRegistration': {
          execution: { type: 'subflow', specName: 'register', detail: 'Registration started', contextBuilder: 'fc.buildContext.registration' },
        },
      },
    } as never)
    mockInvokeEffect.mockResolvedValueOnce({
      earlyReturn: true,
      detail: '你已经注册了「TestApp」。',
    })

    const result = await dispatchFC(makeSession(), makeResponse(), 'GM.startRegistration', 'msg', testUser)

    expect(result.status).toBe('executed')
    expect(result.detail).toBe('你已经注册了「TestApp」。')
    expect(mockActivateSubFlow).not.toHaveBeenCalled()
  })

  it('uses context builder for GM.startAppSettings', async () => {
    mockGetOntology.mockReturnValue({
      functionCalls: {
        'GM.startAppSettings': {
          execution: { type: 'subflow', specName: 'app-settings', detail: 'Settings opened', contextBuilder: 'fc.buildContext.appSettings' },
        },
      },
    } as never)
    mockInvokeEffect.mockResolvedValueOnce({
      context: { userApps: [{ id: 'a1', name: 'MyApp' }] },
    })

    const session = makeSession()
    const result = await dispatchFC(session, makeResponse(), 'GM.startAppSettings', 'msg', testUser)

    expect(result.status).toBe('executed')
    expect(mockInvokeEffect).toHaveBeenCalledWith(
      'fc.buildContext.appSettings',
      {},
      expect.objectContaining({ session }),
    )
    expect(mockActivateSubFlow).toHaveBeenCalledWith(
      session,
      'app-settings',
      { userApps: [{ id: 'a1', name: 'MyApp' }] },
    )
  })
})

// ═══════════════════════════════════════════════════
// Handler type
// ═══════════════════════════════════════════════════

describe('dispatchFC — handler type', () => {
  it('invokes registered effect handler', async () => {
    mockGetOntology.mockReturnValue({
      functionCalls: {
        'GM.assignMission': {
          execution: { type: 'handler', handlerKey: 'assignMission' },
        },
      },
    } as never)
    mockInvokeEffect.mockResolvedValue({
      name: 'GM.assignMission',
      status: 'executed',
      detail: 'Mission assigned',
    })

    const result = await dispatchFC(
      makeSession(), makeResponse(), 'GM.assignMission', 'test message', testUser,
    )

    expect(result.status).toBe('executed')
    expect(result.detail).toBe('Mission assigned')
    expect(mockInvokeEffect).toHaveBeenCalledWith(
      'assignMission',
      expect.objectContaining({ message: 'test message' }),
      expect.objectContaining({ user: testUser }),
    )
  })

  it('applies response template replacement for assignMission selected app', async () => {
    mockGetOntology.mockReturnValue({
      functionCalls: {
        'GM.assignMission': {
          execution: { type: 'handler', handlerKey: 'assignMission' },
        },
      },
    } as never)
    mockInvokeEffect.mockResolvedValue({
      name: 'GM.assignMission',
      status: 'executed',
      detail: 'ok',
      selected: { name: 'CoolApp', clientId: 'cool-123', website: 'https://cool.app' },
    })

    const response = makeResponse()
    response.message = {
      pa: '你被分配去体验{appName}，访问{appUrl}',
      agent: 'Assigned to {clientId}',
    }

    await dispatchFC(makeSession(), response, 'GM.assignMission', 'msg', testUser)

    expect(response.message.pa).toContain('CoolApp')
    expect(response.message.pa).toContain('https://cool.app')
    expect(response.message.agent).toContain('cool-123')
  })
})

// ═══════════════════════════════════════════════════
// Behavior type
// ═══════════════════════════════════════════════════

describe('dispatchFC — behavior type', () => {
  it('activates behavior spec by specName', async () => {
    mockGetOntology.mockReturnValue({
      functionCalls: {
        'GM.browseApps': {
          execution: { type: 'behavior', specName: 'browse_apps', detail: 'Browsing activated' },
        },
      },
    } as never)

    const session = makeSession()
    const result = await dispatchFC(session, makeResponse(), 'GM.browseApps', 'msg', testUser)

    expect(result.status).toBe('executed')
    expect(result.detail).toBe('Browsing activated')
    expect(mockActivateBehavior).toHaveBeenCalledWith(session, 'browse_apps')
  })

  it('returns skipped when behavior specName is missing', async () => {
    mockGetOntology.mockReturnValue({
      functionCalls: {
        'GM.broken': {
          execution: { type: 'behavior' },
        },
      },
    } as never)

    const result = await dispatchFC(makeSession(), makeResponse(), 'GM.broken', 'msg', testUser)

    expect(result.status).toBe('skipped')
    expect(result.detail).toContain('No specName')
  })
})

// ═══════════════════════════════════════════════════
// Unknown execution type
// ═══════════════════════════════════════════════════

describe('dispatchFC — unknown execution type', () => {
  it('returns skipped for unknown type', async () => {
    mockGetOntology.mockReturnValue({
      functionCalls: {
        'GM.future': {
          execution: { type: 'quantum' },
        },
      },
    } as never)

    const result = await dispatchFC(makeSession(), makeResponse(), 'GM.future', 'msg', testUser)

    expect(result.status).toBe('skipped')
  })
})
