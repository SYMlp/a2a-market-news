import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/community', () => ({
  listCircles: vi.fn(),
}))

import { listCircles } from '@/lib/community'
import { GET } from './route'

const mockList = vi.mocked(listCircles)

beforeEach(() => vi.clearAllMocks())

describe('GET /api/circles', () => {
  it('returns success with circle data', async () => {
    mockList.mockResolvedValue({
      ok: true,
      data: [{ id: 'c1', slug: 'internet', name: 'Internet' }] as never,
    })

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toHaveLength(1)
    expect(json.data[0].slug).toBe('internet')
  })

  it('returns error payload when listCircles fails', async () => {
    mockList.mockResolvedValue({ ok: false, error: '获取失败', status: 500 })

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('获取失败')
  })
})
