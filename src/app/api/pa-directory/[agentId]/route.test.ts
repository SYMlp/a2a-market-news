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
  getPADetail: vi.fn(),
}))

import { getPADetail } from '@/lib/pa-directory'
import { GET } from './route'

const mockGet = vi.mocked(getPADetail)

beforeEach(() => vi.clearAllMocks())

describe('GET /api/pa-directory/:agentId', () => {
  it('returns 404 when PA not found', async () => {
    mockGet.mockResolvedValue({ ok: false, error: 'PA not found', status: 404 })

    const res = await GET(new NextRequest('http://localhost/api/pa-directory/unknown'), {
      params: Promise.resolve({ agentId: 'unknown' }),
    })

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('PA not found')
    expect(mockGet).toHaveBeenCalledWith('unknown')
  })

  it('returns success with detail payload', async () => {
    mockGet.mockResolvedValue({
      ok: true,
      data: { agentId: 'ag-1', agentName: 'Test PA', questions: [] },
    })

    const res = await GET(new NextRequest('http://localhost/api/pa-directory/ag-1'), {
      params: Promise.resolve({ agentId: 'ag-1' }),
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.agentId).toBe('ag-1')
  })
})
