import { NextRequest } from 'next/server'
import { ensureDomainBootstrap } from '@/lib/domain-runtime/bootstrap'
import { createDomainHandlers } from '@/lib/domain-runtime'

ensureDomainBootstrap()
const handlers = createDomainHandlers('practices')

export async function GET(request: NextRequest) {
  return handlers.list(request)
}

export async function POST(request: NextRequest) {
  return handlers.create(request)
}
