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
  mockHandlers.list.mockResolvedValue(NextResponse.json({ success: true, data: [] }))
  mockHandlers.create.mockResolvedValue(NextResponse.json({ success: true, data: { id: 'p1' } }))
})

describe('GET /api/practices', () => {
  it('delegates to DomainSpec handlers.list', async () => {
    const req = new NextRequest('http://localhost/api/practices')
    await GET(req)
    expect(mockHandlers.list).toHaveBeenCalledTimes(1)
    expect(mockHandlers.list).toHaveBeenCalledWith(req)
  })
})

describe('POST /api/practices', () => {
  it('delegates to DomainSpec handlers.create', async () => {
    const req = new NextRequest('http://localhost/api/practices', {
      method: 'POST',
      body: JSON.stringify({ title: 'T', bodyMd: 'x' }),
    })
    await POST(req)
    expect(mockHandlers.create).toHaveBeenCalledTimes(1)
    expect(mockHandlers.create).toHaveBeenCalledWith(req)
  })
})
