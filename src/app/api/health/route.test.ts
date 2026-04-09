import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'
import { REQUEST_ID_HEADER } from '@/lib/request-id'

describe('GET /api/health', () => {
  it('returns ok and echoes x-request-id when provided', async () => {
    const id = 'req-trace-abc'
    const req = new NextRequest(new URL('http://localhost/api/health'), {
      headers: { [REQUEST_ID_HEADER]: id },
    })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.requestId).toBe(id)
    expect(res.headers.get(REQUEST_ID_HEADER)).toBe(id)
  })

  it('generates request id when header is absent', async () => {
    const req = new NextRequest(new URL('http://localhost/api/health'))
    const res = await GET(req)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(typeof json.requestId).toBe('string')
    expect(json.requestId.length).toBeGreaterThan(10)
  })
})
