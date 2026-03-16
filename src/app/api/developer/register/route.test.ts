import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { update: vi.fn() } },
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { POST } from './route'

const mockGetUser = vi.mocked(getCurrentUser)
const mockUserUpdate = vi.mocked(prisma.user.update)

function req(body: unknown): NextRequest {
  return new NextRequest(new URL('http://localhost/api/developer/register'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

beforeEach(() => vi.clearAllMocks())

describe('POST /api/developer/register', () => {
  it('returns 401 when not logged in', async () => {
    mockGetUser.mockResolvedValue(null as never)
    const res = await POST(req({ developerName: 'test' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when developerName is empty', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1' } as never)
    const res = await POST(req({ developerName: '' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when developerName is missing', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1' } as never)
    const res = await POST(req({}))
    expect(res.status).toBe(400)
  })

  it('returns 400 when developerName is whitespace-only', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1' } as never)
    const res = await POST(req({ developerName: '   ' }))
    expect(res.status).toBe(400)
  })

  it('registers developer with valid data', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1' } as never)
    mockUserUpdate.mockResolvedValue({
      id: 'u-1',
      isDeveloper: true,
      developerName: 'MyDev',
      callbackUrl: 'https://example.com/hook',
      notifyPreference: 'both',
    } as never)

    const res = await POST(
      req({
        developerName: 'MyDev',
        callbackUrl: 'https://example.com/hook',
        notifyPreference: 'both',
      })
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.isDeveloper).toBe(true)
    expect(json.data.developerName).toBe('MyDev')
  })

  it('sets isDeveloper to true in database', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1' } as never)
    mockUserUpdate.mockResolvedValue({ id: 'u-1' } as never)

    await POST(req({ developerName: 'Dev' }))

    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: expect.objectContaining({ isDeveloper: true }),
    })
  })

  it('defaults notifyPreference to "in_app" for invalid value', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1' } as never)
    mockUserUpdate.mockResolvedValue({ id: 'u-1' } as never)

    await POST(req({ developerName: 'Dev', notifyPreference: 'invalid_pref' }))

    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: expect.objectContaining({ notifyPreference: 'in_app' }),
    })
  })

  it('accepts all valid notifyPreference values', async () => {
    for (const pref of ['none', 'callback', 'in_app', 'both']) {
      vi.clearAllMocks()
      mockGetUser.mockResolvedValue({ id: 'u-1' } as never)
      mockUserUpdate.mockResolvedValue({ id: 'u-1' } as never)

      await POST(req({ developerName: 'Dev', notifyPreference: pref }))

      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: 'u-1' },
        data: expect.objectContaining({ notifyPreference: pref }),
      })
    }
  })

  it('trims developerName', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1' } as never)
    mockUserUpdate.mockResolvedValue({ id: 'u-1' } as never)

    await POST(req({ developerName: '  MyDev  ' }))

    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: expect.objectContaining({ developerName: 'MyDev' }),
    })
  })

  it('sets callbackUrl to null when empty', async () => {
    mockGetUser.mockResolvedValue({ id: 'u-1' } as never)
    mockUserUpdate.mockResolvedValue({ id: 'u-1' } as never)

    await POST(req({ developerName: 'Dev', callbackUrl: '' }))

    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: expect.objectContaining({ callbackUrl: null }),
    })
  })
})
