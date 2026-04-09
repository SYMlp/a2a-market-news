import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../prisma', () => ({
  prisma: {
    pointTransaction: {
      create: vi.fn().mockResolvedValue({}),
      aggregate: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    user: { findUnique: vi.fn() },
    pAVisitor: { upsert: vi.fn().mockResolvedValue({}) },
    dailyTaskProgress: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from '../prisma'
import { addPoints, getPointsBalance, getPointsHistory, incrementDailyTask, getDailyTaskProgress, DAILY_TASKS } from './points'

const mockTxCreate = vi.mocked(prisma.pointTransaction.create)
const mockTxAggregate = vi.mocked(prisma.pointTransaction.aggregate)
const mockUserFind = vi.mocked(prisma.user.findUnique)
const mockVisitorUpsert = vi.mocked(prisma.pAVisitor.upsert)
const mockDailyUpsert = vi.mocked(prisma.dailyTaskProgress.upsert)
const mockDailyFindMany = vi.mocked(prisma.dailyTaskProgress.findMany)

beforeEach(() => vi.clearAllMocks())

// ═══════════════════════════════════════════════════
// addPoints
// ═══════════════════════════════════════════════════

describe('addPoints', () => {
  it('creates transaction and returns balance from aggregate', async () => {
    mockUserFind.mockResolvedValue({ id: 'u1', secondmeUserId: 'sm1', name: 'Alice' } as never)
    mockTxAggregate.mockResolvedValue({ _sum: { amount: 120 } } as never)

    const result = await addPoints('u1', 'review', '评价了应用', 20)

    expect(mockTxCreate).toHaveBeenCalledWith({
      data: { userId: 'u1', amount: 20, source: 'review', description: '评价了应用' },
    })
    expect(result.newBalance).toBe(120)
  })

  it('uses default amount from POINTS_TABLE when not specified', async () => {
    mockUserFind.mockResolvedValue(null as never)
    mockTxAggregate.mockResolvedValue({ _sum: { amount: 5 } } as never)

    await addPoints('u1', 'vote', 'voted')

    expect(mockTxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ amount: 5 }),
    })
  })

  it('returns 0 balance when amount is 0 or negative', async () => {
    const result = await addPoints('u1', 'unknown_source', 'test')

    expect(mockTxCreate).not.toHaveBeenCalled()
    expect(result.newBalance).toBe(0)
  })

  it('upserts PAVisitor when user has secondmeUserId', async () => {
    mockUserFind.mockResolvedValue({ id: 'u1', secondmeUserId: 'sm1', name: 'Bob' } as never)
    mockTxAggregate.mockResolvedValue({ _sum: { amount: 50 } } as never)

    await addPoints('u1', 'review', 'test', 20)

    expect(mockVisitorUpsert).toHaveBeenCalledWith({
      where: { agentId: 'sm1' },
      update: { points: { increment: 20 } },
      create: expect.objectContaining({ agentId: 'sm1', agentName: 'Bob', points: 20 }),
    })
  })

  it('skips PAVisitor upsert when user not found', async () => {
    mockUserFind.mockResolvedValue(null as never)
    mockTxAggregate.mockResolvedValue({ _sum: { amount: 10 } } as never)

    await addPoints('u1', 'vote', 'test', 5)

    expect(mockVisitorUpsert).not.toHaveBeenCalled()
  })
})

// ═══════════════════════════════════════════════════
// getPointsBalance
// ═══════════════════════════════════════════════════

describe('getPointsBalance', () => {
  it('returns sum of all transactions', async () => {
    mockTxAggregate.mockResolvedValue({ _sum: { amount: 250 } } as never)

    const balance = await getPointsBalance('u1')

    expect(balance).toBe(250)
    expect(mockTxAggregate).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      _sum: { amount: true },
    })
  })

  it('returns 0 when no transactions exist', async () => {
    mockTxAggregate.mockResolvedValue({ _sum: { amount: null } } as never)

    const balance = await getPointsBalance('u1')
    expect(balance).toBe(0)
  })
})

// ═══════════════════════════════════════════════════
// getPointsHistory
// ═══════════════════════════════════════════════════

describe('getPointsHistory', () => {
  it('returns transactions with correct pagination', async () => {
    const mockTxFindMany = vi.mocked(prisma.pointTransaction.findMany)
    const mockTxCount = vi.mocked(prisma.pointTransaction.count)
    mockTxFindMany.mockResolvedValue([{ id: 'tx1' }] as never)
    mockTxCount.mockResolvedValue(42 as never)

    const result = await getPointsHistory('u1', 2, 10)

    expect(result.transactions).toHaveLength(1)
    expect(result.total).toBe(42)
    expect(mockTxFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    )
  })
})

// ═══════════════════════════════════════════════════
// incrementDailyTask
// ═══════════════════════════════════════════════════

describe('incrementDailyTask', () => {
  it('returns { completed: false, allDone: false } for unknown task key', async () => {
    const result = await incrementDailyTask('u1', 'nonexistent_task')
    expect(result.completed).toBe(false)
  })

  it('upserts progress and returns completed=true when target is reached', async () => {
    const reviewTask = DAILY_TASKS.find(t => t.key === 'review')!
    mockDailyUpsert.mockResolvedValue({ progress: reviewTask.target } as never)
    mockDailyFindMany.mockResolvedValue([{ taskKey: 'review', progress: 1 }] as never)
    mockUserFind.mockResolvedValue(null as never)
    mockTxAggregate.mockResolvedValue({ _sum: { amount: 0 } } as never)

    const result = await incrementDailyTask('u1', 'review')

    expect(result.completed).toBe(true)
    expect(mockTxCreate).toHaveBeenCalled()
  })

  it('returns completed=false when progress is below target', async () => {
    mockDailyUpsert.mockResolvedValue({ progress: 1 } as never)
    mockDailyFindMany.mockResolvedValue([] as never)

    const result = await incrementDailyTask('u1', 'vote')
    expect(result.completed).toBe(false)
  })
})

// ═══════════════════════════════════════════════════
// getDailyTaskProgress
// ═══════════════════════════════════════════════════

describe('getDailyTaskProgress', () => {
  it('returns all tasks with progress merged from DB records', async () => {
    mockDailyFindMany.mockResolvedValue([
      { taskKey: 'review', progress: 1 },
    ] as never)

    const tasks = await getDailyTaskProgress('u1')

    expect(tasks).toHaveLength(DAILY_TASKS.length)
    const review = tasks.find(t => t.key === 'review')!
    expect(review.progress).toBe(1)
    expect(review.completed).toBe(true)

    const vote = tasks.find(t => t.key === 'vote')!
    expect(vote.progress).toBe(0)
    expect(vote.completed).toBe(false)
  })
})
