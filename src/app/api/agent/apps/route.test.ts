import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/agent-auth', () => ({
  validateAgentToken: vi.fn().mockReturnValue(null),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    circle: { findFirst: vi.fn() },
    app: { findMany: vi.fn(), count: vi.fn() },
    appFeedback: { groupBy: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { GET } from './route'

const mockCircleFind = vi.mocked(prisma.circle.findFirst)
const mockAppFindMany = vi.mocked(prisma.app.findMany)
const mockAppCount = vi.mocked(prisma.app.count)
const mockFeedbackGroupBy = vi.mocked(prisma.appFeedback.groupBy)

function req(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), { method: 'GET' })
}

beforeEach(() => vi.clearAllMocks())

describe('GET /api/agent/apps', () => {
  it('returns apps with pagination', async () => {
    mockAppFindMany.mockResolvedValue([
      {
        id: 'app-1',
        name: 'App1',
        description: 'desc',
        website: null,
        logo: null,
        clientId: 'c-1',
        circle: { name: 'Internet', slug: 'internet', type: 'internet' },
        featured: false,
        _count: { feedbacks: 3 },
        createdAt: new Date('2026-01-01'),
      },
    ] as never)
    mockAppCount.mockResolvedValue(1 as never)

    const res = await GET(req('/api/agent/apps'))
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(json.data).toHaveLength(1)
    expect(json.data[0].feedbackCount).toBe(3)
    expect(json.pagination.total).toBe(1)
  })

  it('filters by circle slug', async () => {
    mockCircleFind.mockResolvedValue({ id: 'circle-1' } as never)
    mockAppFindMany.mockResolvedValue([] as never)
    mockAppCount.mockResolvedValue(0 as never)

    await GET(req('/api/agent/apps?circle=internet'))

    expect(mockCircleFind).toHaveBeenCalledWith({
      where: { OR: [{ slug: 'internet' }, { type: 'internet' }] },
    })
    expect(mockAppFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ circleId: 'circle-1' }),
      })
    )
  })

  it('filters by minimum rating', async () => {
    mockAppFindMany.mockResolvedValue([
      { id: 'app-1', name: 'A', description: '', website: null, logo: null, clientId: 'c-1', circle: {}, featured: false, _count: { feedbacks: 5 }, createdAt: new Date() },
      { id: 'app-2', name: 'B', description: '', website: null, logo: null, clientId: 'c-2', circle: {}, featured: false, _count: { feedbacks: 2 }, createdAt: new Date() },
    ] as never)
    mockAppCount.mockResolvedValue(2 as never)
    mockFeedbackGroupBy.mockResolvedValue([
      { appId: 'app-1', _avg: { overallRating: 4.5 } },
      { appId: 'app-2', _avg: { overallRating: 2.0 } },
    ] as never)

    const res = await GET(req('/api/agent/apps?rating=4'))
    const json = await res.json()

    expect(json.data).toHaveLength(1)
    expect(json.data[0].name).toBe('A')
  })

  it('returns correct pagination for page=2 limit=5', async () => {
    mockAppFindMany.mockResolvedValue([] as never)
    mockAppCount.mockResolvedValue(12 as never)

    const res = await GET(req('/api/agent/apps?page=2&limit=5'))
    const json = await res.json()

    expect(json.pagination).toEqual({
      page: 2,
      limit: 5,
      total: 12,
      totalPages: 3,
    })
    expect(mockAppFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 })
    )
  })

  it('only shows active apps', async () => {
    mockAppFindMany.mockResolvedValue([] as never)
    mockAppCount.mockResolvedValue(0 as never)

    await GET(req('/api/agent/apps'))

    expect(mockAppFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'active' }),
      })
    )
  })

  it('returns 500 on error', async () => {
    mockAppFindMany.mockRejectedValue(new Error('DB error'))

    const res = await GET(req('/api/agent/apps'))
    expect(res.status).toBe(500)
  })
})
