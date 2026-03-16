import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    appPA: { findUnique: vi.fn() },
    appFeedback: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  },
}))

vi.mock('@/lib/feedback-schema', () => ({
  validateFeedback: vi.fn(),
}))

vi.mock('@/lib/notification', () => ({
  notifyDeveloper: vi.fn().mockResolvedValue(undefined),
}))

import { prisma } from '@/lib/prisma'
import { validateFeedback } from '@/lib/feedback-schema'
import { notifyDeveloper } from '@/lib/notification'
import { POST, GET } from './route'

const mockValidate = vi.mocked(validateFeedback)
const mockAppPAFind = vi.mocked(prisma.appPA.findUnique)
const mockFeedbackCreate = vi.mocked(prisma.appFeedback.create)
const mockFeedbackFindMany = vi.mocked(prisma.appFeedback.findMany)
const mockFeedbackCount = vi.mocked(prisma.appFeedback.count)
const mockNotify = vi.mocked(notifyDeveloper)

const VALID_BODY = {
  targetClientId: 'client-abc',
  agentId: 'agent-001',
  agentName: 'TestPA',
  agentType: 'pa',
  overallRating: 4,
  summary: 'Nice app',
}

function makeRequest(method: string, url: string, body?: unknown): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── POST /api/feedback ───────────────────────────────────────────────

describe('POST /api/feedback', () => {
  it('returns 400 when validation fails', async () => {
    mockValidate.mockReturnValue({
      valid: false,
      errors: [{ message: 'missing field' } as never],
    })

    const res = await POST(makeRequest('POST', '/api/feedback', VALID_BODY))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('validation failed')
  })

  it('creates feedback and returns success', async () => {
    mockValidate.mockReturnValue({ valid: true, errors: null })
    mockAppPAFind.mockResolvedValue(null as never)
    const created = { id: 'fb-001', ...VALID_BODY }
    mockFeedbackCreate.mockResolvedValue(created as never)

    const res = await POST(makeRequest('POST', '/api/feedback', VALID_BODY))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.id).toBe('fb-001')
  })

  it('resolves developer from appPA and triggers notification', async () => {
    mockValidate.mockReturnValue({ valid: true, errors: null })
    mockAppPAFind.mockResolvedValue({
      id: 'app-001',
      name: 'TestApp',
      developerId: 'dev-001',
      developer: { id: 'dev-001' },
    } as never)
    mockFeedbackCreate.mockResolvedValue({ id: 'fb-002' } as never)

    await POST(makeRequest('POST', '/api/feedback', VALID_BODY))

    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        developerId: 'dev-001',
        feedbackId: 'fb-002',
        appClientId: 'client-abc',
        appName: 'TestApp',
      })
    )
  })

  it('does not notify when appPA has no developer', async () => {
    mockValidate.mockReturnValue({ valid: true, errors: null })
    mockAppPAFind.mockResolvedValue({ id: 'app-002', developerId: null } as never)
    mockFeedbackCreate.mockResolvedValue({ id: 'fb-003' } as never)

    await POST(makeRequest('POST', '/api/feedback', VALID_BODY))

    expect(mockNotify).not.toHaveBeenCalled()
  })

  it('still creates feedback for unknown clientId (appPA not found)', async () => {
    mockValidate.mockReturnValue({ valid: true, errors: null })
    mockAppPAFind.mockResolvedValue(null as never)
    mockFeedbackCreate.mockResolvedValue({ id: 'fb-004' } as never)

    const res = await POST(makeRequest('POST', '/api/feedback', VALID_BODY))
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(mockFeedbackCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        appPAId: null,
        developerId: null,
      }),
    })
  })

  it('returns 500 on unexpected error', async () => {
    mockValidate.mockReturnValue({ valid: true, errors: null })
    mockAppPAFind.mockRejectedValue(new Error('DB down'))

    const res = await POST(makeRequest('POST', '/api/feedback', VALID_BODY))
    expect(res.status).toBe(500)
  })
})

// ─── GET /api/feedback ────────────────────────────────────────────────

describe('GET /api/feedback', () => {
  it('queries by clientId', async () => {
    mockFeedbackFindMany.mockResolvedValue([] as never)
    mockFeedbackCount.mockResolvedValue(0 as never)

    const res = await GET(makeRequest('GET', '/api/feedback?clientId=abc'))
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(mockFeedbackFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          targetClientId: 'abc',
          status: 'published',
        }),
      })
    )
  })

  it('queries by agentId', async () => {
    mockFeedbackFindMany.mockResolvedValue([] as never)
    mockFeedbackCount.mockResolvedValue(0 as never)

    await GET(makeRequest('GET', '/api/feedback?agentId=agent-x'))

    expect(mockFeedbackFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ agentId: 'agent-x' }),
      })
    )
  })

  it('returns correct pagination', async () => {
    mockFeedbackFindMany.mockResolvedValue([{ id: 'fb-1' }] as never)
    mockFeedbackCount.mockResolvedValue(42 as never)

    const res = await GET(makeRequest('GET', '/api/feedback?page=2&limit=10'))
    const json = await res.json()

    expect(json.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 42,
      totalPages: 5,
    })
    expect(mockFeedbackFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 })
    )
  })

  it('clamps limit to max 50', async () => {
    mockFeedbackFindMany.mockResolvedValue([] as never)
    mockFeedbackCount.mockResolvedValue(0 as never)

    await GET(makeRequest('GET', '/api/feedback?limit=100'))

    expect(mockFeedbackFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 })
    )
  })

  it('defaults page=1 and limit=20', async () => {
    mockFeedbackFindMany.mockResolvedValue([] as never)
    mockFeedbackCount.mockResolvedValue(0 as never)

    await GET(makeRequest('GET', '/api/feedback'))

    expect(mockFeedbackFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 })
    )
  })

  it('only shows published feedback', async () => {
    mockFeedbackFindMany.mockResolvedValue([] as never)
    mockFeedbackCount.mockResolvedValue(0 as never)

    await GET(makeRequest('GET', '/api/feedback'))

    expect(mockFeedbackFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'published' }),
      })
    )
  })

  it('returns 500 on database error', async () => {
    mockFeedbackFindMany.mockRejectedValue(new Error('timeout'))

    const res = await GET(makeRequest('GET', '/api/feedback'))
    expect(res.status).toBe(500)
  })
})
