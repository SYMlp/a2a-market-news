import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./points', () => ({
  addPoints: vi.fn().mockResolvedValue({ newBalance: 100 }),
  incrementDailyTask: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./achievements', () => ({
  processAchievements: vi.fn().mockResolvedValue({
    newUnlocks: [{ key: 'k1', name: 'Achievement', icon: '⭐', tier: 'bronze' }],
  }),
}))

vi.mock('@/lib/pa-actions', () => ({
  logPAAction: vi.fn().mockResolvedValue({ id: 'log-1' }),
}))

import { addPoints, incrementDailyTask } from './points'
import { processAchievements } from './achievements'
import { logPAAction } from '@/lib/pa-actions'
import { rewardReview } from './reward-pipeline'

const mockAddPoints = vi.mocked(addPoints)
const mockIncrementDaily = vi.mocked(incrementDailyTask)
const mockAchievements = vi.mocked(processAchievements)
const mockLogPA = vi.mocked(logPAAction)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('rewardReview', () => {
  it('runs points, achievements, daily task, and PA action log in parallel', async () => {
    const result = await rewardReview({
      userId: 'u1',
      agentId: 'a1',
      agentName: 'PA',
      appId: 'app1',
      appName: 'Test App',
      content: 'Great app',
      structured: { rating: 5 },
      pointsAmount: 20,
    })

    expect(mockAchievements).toHaveBeenCalledWith('a1', 'PA', 'human', 'app1')
    expect(mockAddPoints).toHaveBeenCalledWith('u1', 'review', '评价了 Test App', 20)
    expect(mockIncrementDaily).toHaveBeenCalledWith('u1', 'review')
    expect(mockLogPA).toHaveBeenCalledWith(
      'u1',
      'review',
      'app1',
      'review:Test App',
      'Great app',
      { rating: 5 },
      20,
    )

    expect(result.newBalance).toBe(100)
    expect(result.achievements).toHaveLength(1)
    expect(result.achievements[0].key).toBe('k1')
  })
})
