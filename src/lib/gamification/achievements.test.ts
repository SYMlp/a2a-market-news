import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../prisma', () => ({
  prisma: {
    pAVisitor: { upsert: vi.fn().mockResolvedValue({}) },
    appFeedback: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    achievementDef: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    achievementUnlock: {
      findUnique: vi.fn(),
      create: vi.fn().mockResolvedValue({}),
    },
  },
}))

import { prisma } from '../prisma'
import { processAchievements } from './achievements'

const mockVisitorUpsert = vi.mocked(prisma.pAVisitor.upsert)
const mockFeedbackCount = vi.mocked(prisma.appFeedback.count)
const mockFeedbackFindMany = vi.mocked(prisma.appFeedback.findMany)
const mockDefFindMany = vi.mocked(prisma.achievementDef.findMany)
const mockDefFindUnique = vi.mocked(prisma.achievementDef.findUnique)
const mockUnlockFind = vi.mocked(prisma.achievementUnlock.findUnique)
const mockUnlockCreate = vi.mocked(prisma.achievementUnlock.create)

beforeEach(() => {
  vi.clearAllMocks()
  mockFeedbackCount.mockResolvedValue(0 as never)
  mockDefFindMany.mockResolvedValue([] as never)
  mockDefFindUnique.mockResolvedValue(null as never)
  mockFeedbackFindMany.mockResolvedValue([] as never)
})

describe('processAchievements', () => {
  it('upserts PA visitor with incremented feedback count', async () => {
    await processAchievements('agent-1', 'TestPA', 'pa', 'client-abc')

    expect(mockVisitorUpsert).toHaveBeenCalledWith({
      where: { agentId: 'agent-1' },
      update: expect.objectContaining({
        agentName: 'TestPA',
        feedbackCount: { increment: 1 },
      }),
      create: expect.objectContaining({
        agentId: 'agent-1',
        agentName: 'TestPA',
        agentType: 'pa',
        feedbackCount: 1,
      }),
    })
  })

  it('sets source to "secondme" for human agents', async () => {
    await processAchievements('agent-1', 'Human', 'human', 'client-abc')

    expect(mockVisitorUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ source: 'secondme' }),
      }),
    )
  })

  it('sets source to "direct" for non-human agents', async () => {
    await processAchievements('agent-1', 'Bot', 'pa', 'client-abc')

    expect(mockVisitorUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ source: 'direct' }),
      }),
    )
  })

  it('unlocks feedback milestone achievement when threshold is met', async () => {
    mockFeedbackCount.mockResolvedValue(5 as never)
    mockDefFindMany.mockResolvedValue([
      { id: 'def-1', key: 'first_review', name: 'First Review', icon: '⭐', tier: 'bronze', threshold: 1, category: 'feedback' },
      { id: 'def-2', key: 'reviewer_5', name: 'Reviewer 5', icon: '🏆', tier: 'silver', threshold: 5, category: 'feedback' },
      { id: 'def-3', key: 'reviewer_10', name: 'Reviewer 10', icon: '💎', tier: 'gold', threshold: 10, category: 'feedback' },
    ] as never)
    mockUnlockFind.mockResolvedValue(null as never)

    const result = await processAchievements('agent-1', 'PA', 'pa', 'client-abc')

    expect(result.newUnlocks).toHaveLength(2)
    expect(result.newUnlocks.map(u => u.key)).toContain('first_review')
    expect(result.newUnlocks.map(u => u.key)).toContain('reviewer_5')
    expect(result.newUnlocks.map(u => u.key)).not.toContain('reviewer_10')
  })

  it('does not re-unlock already unlocked achievements', async () => {
    mockFeedbackCount.mockResolvedValue(5 as never)
    mockDefFindMany.mockResolvedValue([
      { id: 'def-1', key: 'first_review', name: 'First', icon: '⭐', tier: 'bronze', threshold: 1, category: 'feedback' },
    ] as never)
    mockUnlockFind.mockResolvedValue({ id: 'existing-unlock' } as never)

    const result = await processAchievements('agent-1', 'PA', 'pa', 'client-abc')

    expect(result.newUnlocks).toHaveLength(0)
    expect(mockUnlockCreate).not.toHaveBeenCalled()
  })

  it('returns empty newUnlocks when no achievements are triggered', async () => {
    mockFeedbackCount.mockResolvedValue(0 as never)
    mockDefFindMany.mockResolvedValue([
      { id: 'def-1', key: 'first_review', threshold: 1, category: 'feedback' },
    ] as never)

    const result = await processAchievements('agent-1', 'PA', 'pa', 'client-abc')

    expect(result.newUnlocks).toEqual([])
  })

  it('checks multi_circle achievement when distinct circles exist', async () => {
    mockFeedbackCount
      .mockResolvedValueOnce(3 as never)
      .mockResolvedValueOnce(0 as never)
      .mockResolvedValueOnce(0 as never)
    mockFeedbackFindMany.mockResolvedValue([
      { app: { circleId: 'c1' } },
      { app: { circleId: 'c2' } },
      { app: { circleId: 'c3' } },
    ] as never)
    mockDefFindUnique.mockResolvedValue({
      id: 'mc-1',
      key: 'multi_circle',
      name: 'Multi Circle',
      icon: '🌐',
      tier: 'silver',
      threshold: 3,
    } as never)
    mockUnlockFind.mockResolvedValue(null as never)

    const result = await processAchievements('agent-1', 'PA', 'pa', 'client-abc')

    expect(result.newUnlocks.some(u => u.key === 'multi_circle')).toBe(true)
  })
})
