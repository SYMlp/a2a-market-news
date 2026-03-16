import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    appPA: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    appPAMetrics: { create: vi.fn() },
    appFeedback: { groupBy: vi.fn() },
    circle: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { GET, POST } from './route'

const mockGetUser = vi.mocked(getCurrentUser)
const mockAppFindMany = vi.mocked(prisma.appPA.findMany)
const mockAppFindUnique = vi.mocked(prisma.appPA.findUnique)
const mockAppCreate = vi.mocked(prisma.appPA.create)
const mockCircleFind = vi.mocked(prisma.circle.findUnique)
const mockMetricsCreate = vi.mocked(prisma.appPAMetrics.create)

function req(method: string, body?: unknown): NextRequest {
  return new NextRequest(new URL('http://localhost/api/developer/apps'), {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

beforeEach(() => vi.clearAllMocks())

// ─── GET /api/developer/apps ──────────────────────────────────────────

describe('GET /api/developer/apps', () => {
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

  it('returns developer apps', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1', isDeveloper: true } as never)
    mockAppFindMany.mockResolvedValue([
      { id: 'app-1', name: 'App1', feedbacks: [], _count: { feedbacks: 0 } },
    ] as never)
    const mockGroupBy = vi.mocked(prisma.appFeedback.groupBy)
    mockGroupBy.mockResolvedValue([] as never)

    const res = await GET()
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(json.data).toHaveLength(1)
    expect(mockAppFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { developerId: 'u-1' },
      })
    )
  })
})

// ─── POST /api/developer/apps ─────────────────────────────────────────

describe('POST /api/developer/apps', () => {
  const validBody = {
    name: 'My A2A App',
    description: 'A great app',
    circleType: 'internet',
    clientId: 'client-new',
  }

  it('returns 401 when not logged in', async () => {
    mockGetUser.mockResolvedValue(null as never)
    const res = await POST(req('POST', validBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 when not a developer', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1', isDeveloper: false } as never)
    const res = await POST(req('POST', validBody))
    expect(res.status).toBe(403)
  })

  it('returns 400 when required fields are missing', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1', isDeveloper: true } as never)

    const res = await POST(req('POST', { name: 'App' }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('Missing required fields')
  })

  it('returns 404 when circle not found', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1', isDeveloper: true } as never)
    mockCircleFind.mockResolvedValue(null as never)

    const res = await POST(req('POST', validBody))
    expect(res.status).toBe(404)
  })

  it('returns 409 when clientId already exists', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1', isDeveloper: true } as never)
    mockCircleFind.mockResolvedValue({ id: 'c-1' } as never)
    mockAppFindUnique.mockResolvedValue({ id: 'existing' } as never)

    const res = await POST(req('POST', validBody))
    expect(res.status).toBe(409)
  })

  it('creates app successfully', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1', isDeveloper: true } as never)
    mockCircleFind.mockResolvedValue({ id: 'c-1' } as never)
    mockAppFindUnique.mockResolvedValue(null as never)
    mockAppCreate.mockResolvedValue({ id: 'app-new', name: 'My A2A App' } as never)
    mockMetricsCreate.mockResolvedValue({} as never)

    const res = await POST(req('POST', validBody))
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(mockAppCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'My A2A App',
        description: 'A great app',
        circleId: 'c-1',
        developerId: 'u-1',
        clientId: 'client-new',
        status: 'active',
      }),
      include: { circle: true },
    })
  })

  it('creates initial metrics record', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1', isDeveloper: true } as never)
    mockCircleFind.mockResolvedValue({ id: 'c-1' } as never)
    mockAppFindUnique.mockResolvedValue(null as never)
    mockAppCreate.mockResolvedValue({ id: 'app-new' } as never)
    mockMetricsCreate.mockResolvedValue({} as never)

    await POST(req('POST', validBody))

    expect(mockMetricsCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ appPAId: 'app-new' }),
    })
  })

  it('sets clientId to null when not provided', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1', isDeveloper: true } as never)
    mockCircleFind.mockResolvedValue({ id: 'c-1' } as never)
    mockAppCreate.mockResolvedValue({ id: 'app-new' } as never)
    mockMetricsCreate.mockResolvedValue({} as never)

    await POST(req('POST', { name: 'App', description: 'desc', circleType: 'internet' }))

    expect(mockAppCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ clientId: null }),
      include: { circle: true },
    })
  })
})
