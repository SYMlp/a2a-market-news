import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    appFeedback: { findMany: vi.fn(), count: vi.fn() },
  },
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { GET } from './route'

const mockGetUser = vi.mocked(getCurrentUser)
const mockFeedbackFindMany = vi.mocked(prisma.appFeedback.findMany)
const mockFeedbackCount = vi.mocked(prisma.appFeedback.count)

function req(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), { method: 'GET' })
}

beforeEach(() => vi.clearAllMocks())

describe('GET /api/developer/feedbacks', () => {
  it('returns 401 when not logged in', async () => {
    mockGetUser.mockResolvedValue(null as never)
    const res = await GET(req('/api/developer/feedbacks'))
    expect(res.status).toBe(401)
  })

  it('returns 403 when not a developer', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1', isDeveloper: false } as never)
    const res = await GET(req('/api/developer/feedbacks'))
    expect(res.status).toBe(403)
  })

  it('returns all feedbacks for developer', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1', isDeveloper: true } as never)
    mockFeedbackFindMany.mockResolvedValue([{ id: 'fb-1' }] as never)
    mockFeedbackCount.mockResolvedValue(1 as never)

    const res = await GET(req('/api/developer/feedbacks'))
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(json.data).toHaveLength(1)
    expect(mockFeedbackFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ developerId: 'u-1' }),
      })
    )
  })

  it('filters by clientId when provided', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1', isDeveloper: true } as never)
    mockFeedbackFindMany.mockResolvedValue([] as never)
    mockFeedbackCount.mockResolvedValue(0 as never)

    await GET(req('/api/developer/feedbacks?clientId=abc'))

    expect(mockFeedbackFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          developerId: 'u-1',
          targetClientId: 'abc',
        }),
      })
    )
  })

  it('respects pagination', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1', isDeveloper: true } as never)
    mockFeedbackFindMany.mockResolvedValue([] as never)
    mockFeedbackCount.mockResolvedValue(100 as never)

    const res = await GET(req('/api/developer/feedbacks?page=3&limit=5'))
    const json = await res.json()

    expect(json.pagination).toEqual({
      page: 3,
      limit: 5,
      total: 100,
      totalPages: 20,
    })
    expect(mockFeedbackFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 5 })
    )
  })

  it('clamps limit to 50', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1', isDeveloper: true } as never)
    mockFeedbackFindMany.mockResolvedValue([] as never)
    mockFeedbackCount.mockResolvedValue(0 as never)

    await GET(req('/api/developer/feedbacks?limit=200'))

    expect(mockFeedbackFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 })
    )
  })
})
