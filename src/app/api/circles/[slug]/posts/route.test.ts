import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/community', () => ({
  getCirclePosts: vi.fn(),
  createCirclePost: vi.fn(),
}))

import { getCirclePosts, createCirclePost } from '@/lib/community'
import { GET, POST } from './route'

const mockGetPosts = vi.mocked(getCirclePosts)
const mockCreatePost = vi.mocked(createCirclePost)

beforeEach(() => vi.clearAllMocks())

describe('GET /api/circles/:slug/posts', () => {
  it('returns posts when service succeeds', async () => {
    mockGetPosts.mockResolvedValue({
      ok: true,
      data: {
        posts: [{ id: 'p1' }] as never,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      } as never,
    })

    const req = new NextRequest('http://localhost/api/circles/foo/posts?page=2&limit=10')
    const res = await GET(req, { params: Promise.resolve({ slug: 'foo' }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockGetPosts).toHaveBeenCalledWith('foo', 2, 10)
  })

  it('returns error when circle or posts unavailable', async () => {
    mockGetPosts.mockResolvedValue({ ok: false, error: '圈子不存在', status: 404 })

    const req = new NextRequest('http://localhost/api/circles/missing/posts')
    const res = await GET(req, { params: Promise.resolve({ slug: 'missing' }) })

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('圈子不存在')
  })
})

describe('POST /api/circles/:slug/posts', () => {
  it('creates post via community service', async () => {
    mockCreatePost.mockResolvedValue({ ok: true, data: { id: 'new-post' } as never })

    const body = { content: 'hello', appId: 'a1' }
    const req = new NextRequest('http://localhost/api/circles/foo/posts', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    const res = await POST(req, { params: Promise.resolve({ slug: 'foo' }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockCreatePost).toHaveBeenCalledWith('foo', body)
  })
})
