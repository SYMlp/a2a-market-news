import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/gamification', () => ({
  getPointsBalance: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

import { getPointsBalance } from '@/lib/gamification'
import { getCurrentUser } from '@/lib/auth'
import { GET } from './route'

const mockBalance = vi.mocked(getPointsBalance)
const mockUser = vi.mocked(getCurrentUser)

const balanceRequest = new NextRequest(new URL('http://localhost/api/points/balance'))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/points/balance', () => {
  it('returns balance when authenticated', async () => {
    mockUser.mockResolvedValue({
      id: 'u1',
      name: 'Test',
      secondmeUserId: 'sm1',
      isDeveloper: false,
    } as never)
    mockBalance.mockResolvedValue(250)

    const res = await GET(balanceRequest)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.balance).toBe(250)
    expect(mockBalance).toHaveBeenCalledWith('u1')
  })

  it('returns 401 when not authenticated', async () => {
    mockUser.mockResolvedValue(null)

    const res = await GET(balanceRequest)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBeTruthy()
  })
})
