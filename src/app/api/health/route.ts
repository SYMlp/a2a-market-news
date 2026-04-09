import { NextResponse } from 'next/server'
import { getOrCreateRequestId, REQUEST_ID_HEADER } from '@/lib/request-id'

/**
 * Liveness probe: returns 200 when the app is up.
 * Echoes `x-request-id` for tracing.
 */
export function GET(request: Request) {
  const requestId = getOrCreateRequestId(request.headers)
  return NextResponse.json(
    { ok: true, requestId },
    { headers: { [REQUEST_ID_HEADER]: requestId } },
  )
}
