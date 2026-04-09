/**
 * DomainSpec Runtime — Public API
 *
 * Import from here, not from individual modules.
 * Architecture: docs/domain-spec-architecture.md
 */

export {
  createDomainHandlers,
  registerGetService,
  registerListService,
  registerSchema,
} from './route-factory'
export type { DomainHandlers, RouteContext } from './route-factory'

export { loadDomainSpec, resetDomainSpecCache } from './parser'

export type {
  DomainSpec,
  AuthPolicy,
  ListOperation,
  CreateOperation,
  GetOperation,
  ActionOperation,
  FilterDef,
  VisibilityRule,
  DomainHandlerContext,
} from './types'
