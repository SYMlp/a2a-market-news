import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/agent-auth', () => ({
  validateAgentToken: vi.fn().mockReturnValue(null),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    app: { findUnique: vi.fn() },
    appFeedback: { create: vi.fn() },
  },
}))

vi.mock('@/lib/feedback-schema', () => ({
  validateFeedback: vi.fn(),
}))

vi.mock('@/lib/notification', () => ({
  notifyDeveloper: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/achievement', () => ({
  processAchievements: vi.fn().mockResolvedValue({ newUnlocks: [] }),
}))

import { prisma } from '@/lib/prisma'
import { validateFeedback } from '@/lib/feedback-schema'
import { notifyDeveloper } from '@/lib/notification'
import { POST } from './route'

const mockValidate = vi.mocked(validateFeedback)
const mockAppFind = vi.mocked(prisma.app.findUnique)
const mockFeedbackCreate = vi.mocked(prisma.appFeedback.create)
const mockNotify = vi.mocked(notifyDeveloper)

const VALID_BODY = {
  targetClientId: 'client-abc',
  agentId: 'agent-001',
  agentName: 'TestPA',
  agentType: 'pa',
  overallRating: 4,
  summary: 'Nice app',
}

function req(body: unknown): NextRequest {
  return new NextRequest(new URL('http://localhost/api/agent/feedback'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

beforeEach(() => vi.clearAllMocks())

describe('POST /api/agent/feedback', () => {
  it('returns 400 on validation failure', async () => {
    mockValidate.mockReturnValue({
      valid: false,
      errors: [{ message: 'bad' } as never],
    })

    const res = await POST(req(VALID_BODY))
    expect(res.status).toBe(400)
  })

  it('creates feedback with resolved developer', async () => {
    mockValidate.mockReturnValue({ valid: true, errors: null })
    mockAppFind.mockResolvedValue({
      id: 'app-1',
      name: 'TestApp',
      developerId: 'dev-1',
      developer: { id: 'dev-1' },
    } as never)
    mockFeedbackCreate.mockResolvedValue({ id: 'fb-1' } as never)

    const res = await POST(req(VALID_BODY))
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(mockFeedbackCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        targetClientId: 'client-abc',
        appId: 'app-1',
        developerId: 'dev-1',
        source: 'direct_api',
      }),
    })
  })

  it('triggers notification when developer exists', async () => {
    mockValidate.mockReturnValue({ valid: true, errors: null })
    mockAppFind.mockResolvedValue({
      id: 'app-1',
      name: 'TestApp',
      developerId: 'dev-1',
    } as never)
    mockFeedbackCreate.mockResolvedValue({ id: 'fb-2' } as never)

    await POST(req(VALID_BODY))

    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        developerId: 'dev-1',
        feedbackId: 'fb-2',
      })
    )
  })

  it('does not notify when no developer', async () => {
    mockValidate.mockReturnValue({ valid: true, errors: null })
    mockAppFind.mockResolvedValue(null as never)
    mockFeedbackCreate.mockResolvedValue({ id: 'fb-3' } as never)

    await POST(req(VALID_BODY))

    expect(mockNotify).not.toHaveBeenCalled()
  })

  it('returns 500 on unexpected error', async () => {
    mockValidate.mockReturnValue({ valid: true, errors: null })
    mockAppFind.mockRejectedValue(new Error('fail'))

    const res = await POST(req(VALID_BODY))
    expect(res.status).toBe(500)
  })
})
