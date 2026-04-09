import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    appFeedback: { count: vi.fn() },
    notificationLog: { create: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { notifyDeveloper } from './notification'

const mockUserFind = vi.mocked(prisma.user.findUnique)
const mockFeedbackCount = vi.mocked(prisma.appFeedback.count)
const mockLogCreate = vi.mocked(prisma.notificationLog.create)

const BASE_OPTS = {
  developerId: 'dev-001',
  feedbackId: 'fb-001',
  appClientId: 'client-abc',
  appName: 'TestApp',
  summary: 'Great app!',
  overallRating: 4,
}

function makeDeveloper(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dev-001',
    callbackUrl: null,
    notifyPreference: 'in_app',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFeedbackCount.mockResolvedValue(5 as never)
  mockLogCreate.mockResolvedValue({} as never)
})

describe('notifyDeveloper', () => {
  it('does nothing if developer not found', async () => {
    mockUserFind.mockResolvedValue(null as never)
    await notifyDeveloper(BASE_OPTS)
    expect(mockLogCreate).not.toHaveBeenCalled()
  })

  it('creates in_app log when preference is "in_app"', async () => {
    mockUserFind.mockResolvedValue(makeDeveloper({ notifyPreference: 'in_app' }) as never)
    await notifyDeveloper(BASE_OPTS)

    expect(mockLogCreate).toHaveBeenCalledTimes(1)
    expect(mockLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        channel: 'in_app',
        status: 'sent',
        developerId: 'dev-001',
        feedbackId: 'fb-001',
      }),
    })
  })

  it('creates in_app log when preference is "none"', async () => {
    mockUserFind.mockResolvedValue(makeDeveloper({ notifyPreference: 'none' }) as never)
    await notifyDeveloper(BASE_OPTS)

    expect(mockLogCreate).toHaveBeenCalledTimes(1)
    expect(mockLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ channel: 'in_app' }),
    })
  })

  it('sends callback when preference is "callback" and callbackUrl exists', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 200 })
    )
    mockUserFind.mockResolvedValue(
      makeDeveloper({
        callbackUrl: 'https://example.com/hook',
        notifyPreference: 'callback',
      }) as never
    )

    await notifyDeveloper(BASE_OPTS)

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.com/hook',
      expect.objectContaining({ method: 'POST' })
    )
    expect(mockLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        channel: 'callback',
        status: 'sent',
      }),
    })

    fetchSpy.mockRestore()
  })

  it('sends both callback and in_app when preference is "both"', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 200 })
    )
    mockUserFind.mockResolvedValue(
      makeDeveloper({
        callbackUrl: 'https://example.com/hook',
        notifyPreference: 'both',
      }) as never
    )

    await notifyDeveloper(BASE_OPTS)

    expect(fetchSpy).toHaveBeenCalled()
    expect(mockLogCreate).toHaveBeenCalledTimes(2)

    const channels = mockLogCreate.mock.calls.map(
      (call) => (call[0] as { data: { channel: string } }).data.channel
    )
    expect(channels).toContain('callback')
    expect(channels).toContain('in_app')

    fetchSpy.mockRestore()
  })

  it('logs "failed" when callback fetch returns non-ok', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 500 })
    )
    mockUserFind.mockResolvedValue(
      makeDeveloper({
        callbackUrl: 'https://example.com/hook',
        notifyPreference: 'callback',
      }) as never
    )

    await notifyDeveloper(BASE_OPTS)

    expect(mockLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        channel: 'callback',
        status: 'failed',
        response: expect.objectContaining({ ok: false }),
      }),
    })

    fetchSpy.mockRestore()
  })

  it('logs "failed" when callback fetch throws', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new Error('Connection refused')
    )
    mockUserFind.mockResolvedValue(
      makeDeveloper({
        callbackUrl: 'https://example.com/hook',
        notifyPreference: 'callback',
      }) as never
    )

    await notifyDeveloper(BASE_OPTS)

    expect(mockLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        channel: 'callback',
        status: 'failed',
        response: expect.objectContaining({ error: expect.stringContaining('Connection refused') }),
      }),
    })

    fetchSpy.mockRestore()
  })

  it('does not send callback when callbackUrl is null even with "callback" preference', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    mockUserFind.mockResolvedValue(
      makeDeveloper({ callbackUrl: null, notifyPreference: 'callback' }) as never
    )

    await notifyDeveloper(BASE_OPTS)

    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('sends correct callback payload structure', async () => {
    let capturedBody = ''
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      capturedBody = (init as RequestInit).body as string
      return new Response(null, { status: 200 })
    })
    mockUserFind.mockResolvedValue(
      makeDeveloper({
        callbackUrl: 'https://example.com/hook',
        notifyPreference: 'callback',
      }) as never
    )

    await notifyDeveloper(BASE_OPTS)

    const parsed = JSON.parse(capturedBody)
    expect(parsed).toEqual({
      type: 'new_feedback',
      appClientId: 'client-abc',
      appName: 'TestApp',
      feedbackCount: 5,
      latestSummary: 'Great app!',
      overallRating: 4,
      viewUrl: '/developer/apps/client-abc/feedbacks',
    })

    fetchSpy.mockRestore()
  })
})
