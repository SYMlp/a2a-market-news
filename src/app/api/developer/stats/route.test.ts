import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    appPA: { count: vi.fn(), findFirst: vi.fn() },
    appFeedback: { count: vi.fn(), aggregate: vi.fn(), groupBy: vi.fn() },
    notificationLog: { count: vi.fn() },
  },
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { GET } from './route'

const mockGetUser = vi.mocked(getCurrentUser)

beforeEach(() => vi.clearAllMocks())

describe('GET /api/developer/stats', () => {
  it('returns 401 when not logged in', async () => {
    mockGetUser.mockResolvedValue(null as never)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 403 when not a developer', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1', isDeveloper: false } as never)
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns aggregated stats', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1', isDeveloper: true } as never)
    vi.mocked(prisma.appPA.count).mockResolvedValue(3 as never)
    vi.mocked(prisma.appFeedback.count).mockResolvedValue(25 as never)
    vi.mocked(prisma.appFeedback.aggregate).mockResolvedValue({
      _avg: { overallRating: 4.2 },
    } as never)
    vi.mocked(prisma.notificationLog.count).mockResolvedValue(5 as never)
    vi.mocked(prisma.appFeedback.groupBy).mockResolvedValue([
      { targetClientId: 'c-1', _count: 10, _avg: { overallRating: 4.5 } },
    ] as never)
    vi.mocked(prisma.appPA.findFirst).mockResolvedValue({
      name: 'App1',
      clientId: 'c-1',
    } as never)

    const res = await GET()
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(json.data.totalApps).toBe(3)
    expect(json.data.totalFeedbacks).toBe(25)
    expect(json.data.avgRating).toBe(4.2)
    expect(json.data.unreadCount).toBe(5)
    expect(json.data.appStats).toHaveLength(1)
    expect(json.data.appStats[0]).toEqual({
      clientId: 'c-1',
      appName: 'App1',
      feedbackCount: 10,
      avgRating: 4.5,
    })
  })

  it('handles zero feedbacks gracefully', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1', isDeveloper: true } as never)
    vi.mocked(prisma.appPA.count).mockResolvedValue(1 as never)
    vi.mocked(prisma.appFeedback.count).mockResolvedValue(0 as never)
    vi.mocked(prisma.appFeedback.aggregate).mockResolvedValue({
      _avg: { overallRating: null },
    } as never)
    vi.mocked(prisma.notificationLog.count).mockResolvedValue(0 as never)
    vi.mocked(prisma.appFeedback.groupBy).mockResolvedValue([] as never)

    const res = await GET()
    const json = await res.json()

    expect(json.data.avgRating).toBe(0)
    expect(json.data.appStats).toEqual([])
  })
})
