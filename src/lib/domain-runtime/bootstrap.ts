/**
 * DomainSpec Runtime — Bootstrap
 *
 * Registers validation schemas, service handlers, and initializes domain specs.
 * Import this once at the top of files that use createDomainHandlers.
 */

import {
  registerGetService,
  registerListService,
  registerSchema,
} from './route-factory'
import { paDirectoryGet, paDirectoryList } from '@/lib/domain-runtime/pa-directory-handlers'
import { practicePostSchema } from '@/lib/validators/schemas/practice-post'

let _initialized = false

export function ensureDomainBootstrap(): void {
  if (_initialized) return
  _initialized = true

  registerSchema('practicePostSchema', practicePostSchema)
  registerListService('paDirectoryList', paDirectoryList)
  registerGetService('paDirectoryGet', paDirectoryGet)
}
