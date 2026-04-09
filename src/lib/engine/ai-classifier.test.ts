import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./match', () => ({
  matchAction: vi.fn(),
}))

vi.mock('@/lib/scenes', () => ({
  listScenes: vi.fn().mockReturnValue([]),
}))

vi.mock('./session-context', () => ({
  buildSessionContextForClassifier: vi.fn().mockReturnValue(''),
  buildActionConstraints: vi.fn().mockReturnValue([]),
}))

vi.mock('./ontology', () => ({
  getCommunicationProtocol: vi.fn().mockReturnValue({
    classifierConfig: {
      actionTagStay: '留在场景',
      actionTagMove: '离开场景',
      promptTemplate: '根据用户在「{sceneLabel}」场景的发言判断意图，选择一个操作。\n\n可用操作：\n{actions}\n\n平台其他场景：\n{otherScenes}{sessionContext}\n\n分类规则：\n{rules}\n\n严格返回 JSON，不要添加任何其他文字：\n{"actionId":"<操作id或空字符串>","confidence":<0.0到1.0>}',
      rules: [
        '意图明确匹配某个操作 → 返回该操作 id',
        '意图涉及其他场景的功能 → 归类为离开场景的操作（通常是 back_lobby）',
        '不可用的操作不应被匹配，即使用户意图明确指向它 → actionId 为空字符串',
        '闲聊或意图不明 → actionId 为空字符串',
      ],
    },
  }),
}))

vi.mock('@/lib/json-utils', () => ({
  parseJSONLoose: vi.fn(),
}))

vi.mock('@/lib/model-config', () => ({
  MODEL_FOR: { actionClassify: 'test-model' },
}))

vi.mock('@/lib/logger', () => ({
  rootLogger: { child: () => ({ info: vi.fn(), warn: vi.fn() }) },
}))

vi.mock('@/lib/pa-actions', () => ({
  callSecondMeStream: vi.fn(),
}))

import { classifyAction, clearClassifierCache } from './ai-classifier'
import { matchAction } from './match'
import { parseJSONLoose } from '@/lib/json-utils'
import { callSecondMeStream } from '@/lib/pa-actions'
import type { Scene, SceneAction } from './types'

const mockMatchAction = vi.mocked(matchAction)
const mockParseJSON = vi.mocked(parseJSONLoose)
const mockCallStream = vi.mocked(callSecondMeStream)

function makeScene(actions: Partial<SceneAction>[] = []): Scene {
  return {
    id: 'news',
    theme: { label: '日报栏', icon: '📰', accent: '#fff' },
    opening: {
      first: { pa: 'welcome', agent: 'welcome' },
    },
    fallback: {
      response: { pa: 'fallback', agent: 'fallback' },
    },
    actions: actions.map((a, i) => ({
      id: a.id ?? `action-${i}`,
      label: a.label ?? { pa: `Action ${i}`, agent: `action_${i}` },
      triggers: a.triggers ?? [],
      outcome: a.outcome ?? 'stay',
      functionCall: a.functionCall ?? { name: `GM.fn${i}`, args: {} },
      actIntent: a.actIntent ?? `intent-${i}`,
      ...a,
    })) as SceneAction[],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  clearClassifierCache()
})

// ═══════════════════════════════════════════════════
// No token → keyword fallback path
// ═══════════════════════════════════════════════════

describe('classifyAction — keyword fallback (no token)', () => {
  it('returns keyword match when no accessToken', async () => {
    const action = { id: 'experience', triggers: ['体验'] }
    const scene = makeScene([action])
    mockMatchAction.mockReturnValue(scene.actions[0])

    const result = await classifyAction({ scene, message: '我要体验' })

    expect(result.actionId).toBe('experience')
    expect(result.source).toBe('keyword')
    expect(result.confidence).toBe(0.5)
  })

  it('returns null actionId when no keyword match', async () => {
    const scene = makeScene([{ id: 'a1', triggers: ['specific'] }])
    mockMatchAction.mockReturnValue(null)

    const result = await classifyAction({ scene, message: '随便聊聊' })

    expect(result.actionId).toBeNull()
    expect(result.confidence).toBe(0)
    expect(result.source).toBe('keyword')
  })
})

// ═══════════════════════════════════════════════════
// AI classification path
// ═══════════════════════════════════════════════════

describe('classifyAction — AI path', () => {
  it('returns AI result when valid and high confidence', async () => {
    const scene = makeScene([{ id: 'experience' }])
    mockCallStream.mockResolvedValue('{"actionId":"experience","confidence":0.95}')
    mockParseJSON.mockReturnValue({ actionId: 'experience', confidence: 0.95 })

    const result = await classifyAction({
      scene,
      message: '我想体验',
      accessToken: 'tok-123',
    })

    expect(result.actionId).toBe('experience')
    expect(result.confidence).toBe(0.95)
    expect(result.source).toBe('ai')
  })

  it('returns null actionId when AI returns unknown action id', async () => {
    const scene = makeScene([{ id: 'experience' }])
    mockCallStream.mockResolvedValue('{"actionId":"nonexistent","confidence":0.9}')
    mockParseJSON.mockReturnValue({ actionId: 'nonexistent', confidence: 0.9 })

    const result = await classifyAction({
      scene,
      message: 'test',
      accessToken: 'tok',
    })

    expect(result.actionId).toBeNull()
  })

  it('falls back to keyword on AI low confidence with keyword override', async () => {
    const action = { id: 'experience', triggers: ['体验'] }
    const scene = makeScene([action])
    mockCallStream.mockResolvedValue('{"actionId":"","confidence":0.3}')
    mockParseJSON.mockReturnValue({ actionId: '', confidence: 0.3 })
    mockMatchAction.mockReturnValue(scene.actions[0])

    const result = await classifyAction({
      scene,
      message: '我要体验这个应用',
      accessToken: 'tok',
    })

    expect(result.actionId).toBe('experience')
    expect(result.source).toBe('keyword')
    expect(result.confidence).toBe(0.6)
  })
})

// ═══════════════════════════════════════════════════
// AI error → keyword fallback
// ═══════════════════════════════════════════════════

describe('classifyAction — AI error fallback', () => {
  it('falls back to keyword when AI throws', async () => {
    const action = { id: 'experience', triggers: ['体验'] }
    const scene = makeScene([action])
    mockCallStream.mockRejectedValue(new Error('network fail'))
    mockMatchAction.mockReturnValue(scene.actions[0])

    const result = await classifyAction({
      scene,
      message: '体验',
      accessToken: 'tok',
    })

    expect(result.actionId).toBe('experience')
    expect(result.source).toBe('keyword')
  })

  it('returns null when AI fails and no keyword match', async () => {
    const scene = makeScene([{ id: 'a1', triggers: ['x'] }])
    mockCallStream.mockRejectedValue(new Error('timeout'))
    mockMatchAction.mockReturnValue(null)

    const result = await classifyAction({
      scene,
      message: '随便',
      accessToken: 'tok',
    })

    expect(result.actionId).toBeNull()
    expect(result.source).toBe('keyword')
  })
})

// ═══════════════════════════════════════════════════
// Cache behavior
// ═══════════════════════════════════════════════════

describe('classifyAction — cache', () => {
  it('returns cached result on second call with same scene+message', async () => {
    const scene = makeScene([{ id: 'experience' }])
    mockCallStream.mockResolvedValue('{"actionId":"experience","confidence":0.95}')
    mockParseJSON.mockReturnValue({ actionId: 'experience', confidence: 0.95 })

    await classifyAction({ scene, message: '体验', accessToken: 'tok' })
    mockCallStream.mockClear()

    const result = await classifyAction({ scene, message: '体验', accessToken: 'tok' })

    expect(result.source).toBe('cache')
    expect(result.actionId).toBe('experience')
    expect(mockCallStream).not.toHaveBeenCalled()
  })

  it('clearClassifierCache removes all cached entries', async () => {
    const scene = makeScene([{ id: 'experience' }])
    mockCallStream.mockResolvedValue('{"actionId":"experience","confidence":0.9}')
    mockParseJSON.mockReturnValue({ actionId: 'experience', confidence: 0.9 })

    await classifyAction({ scene, message: '体验', accessToken: 'tok' })
    clearClassifierCache()
    mockCallStream.mockClear()

    mockCallStream.mockResolvedValue('{"actionId":"experience","confidence":0.9}')
    mockParseJSON.mockReturnValue({ actionId: 'experience', confidence: 0.9 })

    const result = await classifyAction({ scene, message: '体验', accessToken: 'tok' })

    expect(result.source).toBe('ai')
    expect(mockCallStream).toHaveBeenCalledTimes(1)
  })
})

// ═══════════════════════════════════════════════════
// Precondition gating
// ═══════════════════════════════════════════════════

describe('classifyAction — precondition gating', () => {
  it('excludes gated actions from keyword match', async () => {
    const { buildActionConstraints } = await import('./session-context')
    vi.mocked(buildActionConstraints).mockReturnValue([
      { actionId: 'gated_action', available: false, reason: 'not ready' },
    ])
    const scene = makeScene([{ id: 'gated_action', triggers: ['report'] }])
    mockMatchAction.mockReturnValue(scene.actions[0])

    const result = await classifyAction({
      scene,
      message: 'report',
      session: makeSession() as never,
    })

    expect(result.actionId).toBeNull()
  })
})

function makeSession(): { id: string; currentScene: string; flags: Record<string, unknown> } {
  return { id: 's', currentScene: 'news', flags: {} }
}
