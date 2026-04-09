import { NextRequest } from 'next/server'
import { ensureDomainBootstrap } from '@/lib/domain-runtime/bootstrap'
import { createDomainHandlers } from '@/lib/domain-runtime'

ensureDomainBootstrap()
const handlers = createDomainHandlers('pa-directory')

export async function GET(request: NextRequest) {
  return handlers.list(request)
}
