import { NextRequest, NextResponse } from 'next/server'

/**
 * Validate agent API key from Authorization header.
 * Expected format: "Bearer <AGENT_API_KEY>"
 * Returns null if valid, or a NextResponse error if invalid.
 */
export function validateAgentToken(request: NextRequest): NextResponse | null {
  const key = process.env.AGENT_API_KEY
  if (!key) {
    return NextResponse.json(
      { error: 'Agent API is not configured' },
      { status: 503 }
    )
  }

  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Missing Authorization header (Bearer token)' },
      { status: 401 }
    )
  }

  const token = auth.slice(7)
  if (token !== key) {
    return NextResponse.json(
      { error: 'Invalid agent API key' },
      { status: 403 }
    )
  }

  return null
}
