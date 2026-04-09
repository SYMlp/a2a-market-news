import { NextRequest } from 'next/server'
import { ensureDomainBootstrap } from '@/lib/domain-runtime/bootstrap'
import { createDomainHandlers } from '@/lib/domain-runtime'

ensureDomainBootstrap()
const handlers = createDomainHandlers('practices')

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  return handlers.get(request, ctx)
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  return handlers.action('like', request, ctx)
}
