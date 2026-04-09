import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => undefined),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}))

vi.mock('@/lib/pa-directory', () => ({
  listPADirectory: vi.fn(),
}))

import { listPADirectory } from '@/lib/pa-directory'
import { GET } from './route'

const mockList = vi.mocked(listPADirectory)

beforeEach(() => vi.clearAllMocks())

describe('GET /api/pa-directory', () => {
  it('returns apiListPage shape on success', async () => {
    mockList.mockResolvedValue({
      ok: true,
      data: {
        visitors: [{ agentId: 'agent-1', agentName: 'PA One', badges: [] }],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
      },
    })

    const req = new NextRequest('http://localhost/api/pa-directory?page=1&limit=50')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toHaveLength(1)
    expect(json.pagination).toEqual({ page: 1, limit: 50, total: 1, totalPages: 1 })
    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 50, search: null, sort: 'lastActive' }),
    )
  })

  it('passes search and sort query params', async () => {
    mockList.mockResolvedValue({
      ok: true,
      data: { visitors: [], pagination: { page: 2, limit: 10, total: 0, totalPages: 0 } },
    })

    const req = new NextRequest(
      'http://localhost/api/pa-directory?page=2&limit=10&search=foo&sort=newest',
    )
    await GET(req)

    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 10, search: 'foo', sort: 'newest' }),
    )
  })

  it('returns apiError when service fails', async () => {
    mockList.mockResolvedValue({ ok: false, error: 'Failed to fetch PA directory', status: 500 })

    const res = await GET(new NextRequest('http://localhost/api/pa-directory'))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('Failed to fetch PA directory')
  })
})
