/**
 * API route to serve ComponentSpec JSON for client-side rendering.
 * Used by SpecFormCard to load spec metadata without bundling fs/parser.
 */

import { NextResponse } from 'next/server'
import { loadSpec } from '@/lib/component-runtime/parser'

const TYPE_TO_SPEC: Record<string, string> = {
  app_settings: 'app-settings',
  profile: 'profile',
  app_lifecycle: 'app-lifecycle',
  register: 'register',
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const specName = TYPE_TO_SPEC[id] ?? id
  try {
    const spec = loadSpec(specName)
    return NextResponse.json(spec)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load spec' },
      { status: 404 }
    )
  }
}
