import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const { mockHandlers } = vi.hoisted(() => ({
  mockHandlers: {
    list: vi.fn(),
    create: vi.fn(),
    get: vi.fn(),
    action: vi.fn(),
  },
}))

vi.mock('@/lib/domain-runtime/bootstrap', () => ({
  ensureDomainBootstrap: vi.fn(),
}))

vi.mock('@/lib/domain-runtime', () => ({
  createDomainHandlers: vi.fn(() => mockHandlers),
}))

import { GET, POST } from './route'

beforeEach(() => {
  vi.clearAllMocks()
  mockHandlers.get.mockResolvedValue(NextResponse.json({ success: true, data: { id: 'p1' } }))
  mockHandlers.action.mockResolvedValue(NextResponse.json({ success: true, data: { liked: true } }))
})

describe('GET /api/practices/:id', () => {
  it('delegates to handlers.get with route context', async () => {
    const req = new NextRequest('http://localhost/api/practices/p1')
    const ctx = { params: Promise.resolve({ id: 'p1' }) }
    await GET(req, ctx)
    expect(mockHandlers.get).toHaveBeenCalledWith(req, ctx)
  })
})

describe('POST /api/practices/:id (like action)', () => {
  it('delegates to handlers.action with like key', async () => {
    const req = new NextRequest('http://localhost/api/practices/p1', { method: 'POST', body: '{}' })
    const ctx = { params: Promise.resolve({ id: 'p1' }) }
    await POST(req, ctx)
    expect(mockHandlers.action).toHaveBeenCalledWith('like', req, ctx)
  })
})
