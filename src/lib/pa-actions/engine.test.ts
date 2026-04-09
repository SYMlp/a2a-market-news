import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../prisma', () => ({
  prisma: {
    pAActionLog: {
      create: vi.fn().mockResolvedValue({ id: 'log-created' }),
    },
  },
}))

import { prisma } from '../prisma'
import { logPAAction } from './engine'

const mockCreate = vi.mocked(prisma.pAActionLog.create)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('logPAAction', () => {
  it('persists truncated prompt/response and structured payload', async () => {
    const longPrompt = 'x'.repeat(3000)
    const longResponse = 'y'.repeat(6000)
    const structured = { vote: 'up' }

    await logPAAction('user-1', 'vote', 'app-1', longPrompt, longResponse, structured, 5)

    expect(mockCreate).toHaveBeenCalledTimes(1)
    const arg = mockCreate.mock.calls[0][0]
    expect(arg.data.userId).toBe('user-1')
    expect(arg.data.actionType).toBe('vote')
    expect(arg.data.targetId).toBe('app-1')
    expect(arg.data.prompt.length).toBeLessThanOrEqual(2000)
    expect(arg.data.response.length).toBeLessThanOrEqual(5000)
    expect(arg.data.pointsEarned).toBe(5)
    expect(arg.data.structured).toEqual(structured)
  })
})
