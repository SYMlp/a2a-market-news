import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { update: vi.fn(), findUnique: vi.fn() } },
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { GET, PUT } from './route'

const mockGetUser = vi.mocked(getCurrentUser)
const mockUserUpdate = vi.mocked(prisma.user.update)
const mockUserFind = vi.mocked(prisma.user.findUnique)

function req(body: unknown): NextRequest {
  return new NextRequest(new URL('http://localhost/api/developer/profile'), {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

function getReq(): NextRequest {
  return new NextRequest(new URL('http://localhost/api/developer/profile'))
}

beforeEach(() => vi.clearAllMocks())

describe('PUT /api/developer/profile', () => {
  it('returns 401 when not logged in', async () => {
    mockGetUser.mockResolvedValue(null as never)
    const res = await PUT(req({ developerName: 'name' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 when user is not a developer', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1', isDeveloper: false } as never)
    const res = await PUT(req({ developerName: 'name' }))
    expect(res.status).toBe(403)
  })

  it('updates developerName', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1', isDeveloper: true } as never)
    mockUserUpdate.mockResolvedValue({
      id: 'u-1',
      developerName: 'NewName',
      callbackUrl: null,
      notifyPreference: 'in_app',
    } as never)

    const res = await PUT(req({ developerName: 'NewName' }))
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(json.data.developerName).toBe('NewName')
  })

  it('updates callbackUrl', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1', isDeveloper: true } as never)
    mockUserUpdate.mockResolvedValue({ id: 'u-1' } as never)

    await PUT(req({ callbackUrl: 'https://new-url.com' }))

    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: expect.objectContaining({ callbackUrl: 'https://new-url.com' }),
    })
  })

  it('updates notifyPreference with valid value', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1', isDeveloper: true } as never)
    mockUserUpdate.mockResolvedValue({ id: 'u-1' } as never)

    await PUT(req({ notifyPreference: 'both' }))

    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: expect.objectContaining({ notifyPreference: 'both' }),
    })
  })

  it('ignores invalid notifyPreference value', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1', isDeveloper: true } as never)
    mockUserUpdate.mockResolvedValue({ id: 'u-1' } as never)

    await PUT(req({ notifyPreference: 'sms' }))

    const updateData = mockUserUpdate.mock.calls[0][0].data as Record<string, unknown>
    expect(updateData.notifyPreference).toBeUndefined()
  })

  it('handles partial updates (only fields provided are updated)', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1', isDeveloper: true } as never)
    mockUserUpdate.mockResolvedValue({ id: 'u-1' } as never)

    await PUT(req({ callbackUrl: 'https://x.com' }))

    const updateData = mockUserUpdate.mock.calls[0][0].data as Record<string, unknown>
    expect(updateData.callbackUrl).toBe('https://x.com')
    expect(updateData.developerName).toBeUndefined()
  })

  it('sets callbackUrl to null when empty string', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1', isDeveloper: true } as never)
    mockUserUpdate.mockResolvedValue({ id: 'u-1' } as never)

    await PUT(req({ callbackUrl: '' }))

    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: expect.objectContaining({ callbackUrl: null }),
    })
  })
})

describe('GET /api/developer/profile', () => {
  it('returns 401 when not logged in', async () => {
    mockGetUser.mockResolvedValue(null as never)
    const res = await GET(getReq())
    expect(res.status).toBe(401)
  })

  it('returns 403 when user is not a developer', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1', isDeveloper: false } as never)
    const res = await GET(getReq())
    expect(res.status).toBe(403)
  })

  it('returns profile data for a developer user', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1', isDeveloper: true } as never)
    mockUserFind.mockResolvedValue({
      id: 'u-1',
      developerName: 'Alice',
      callbackUrl: 'https://example.com/hook',
      notifyPreference: 'both',
    } as never)

    const res = await GET(getReq())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toEqual({
      id: 'u-1',
      developerName: 'Alice',
      callbackUrl: 'https://example.com/hook',
      notifyPreference: 'both',
    })
    expect(mockUserFind).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      select: {
        id: true,
        developerName: true,
        callbackUrl: true,
        notifyPreference: true,
      },
    })
  })

  it('returns 404 when profile is not found', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1', isDeveloper: true } as never)
    mockUserFind.mockResolvedValue(null as never)

    const res = await GET(getReq())
    expect(res.status).toBe(404)
  })
})
