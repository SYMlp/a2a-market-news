/**
 * DomainSpec Runtime — Parser
 *
 * Loads DomainSpec YAML files from specs/domains/, validates structure,
 * and caches parsed specs.
 *
 * Architecture: docs/domain-spec-architecture.md §3
 */

import { parse as parseYaml } from 'yaml'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { DomainSpec } from './types'

const DOMAINS_DIR = join(process.cwd(), 'specs', 'domains')

const VALID_AUTH_POLICIES = new Set(['public', 'authenticated', 'developer'])
const VALID_FILTER_TYPES = new Set(['exact', 'enum', 'array_contains', 'search'])

const _cache = new Map<string, DomainSpec>()

function validateDomainSpec(raw: unknown, sourceHint: string): DomainSpec {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`DomainSpec (${sourceHint}): must be an object`)
  }

  const obj = raw as Record<string, unknown>

  if (!obj.id || typeof obj.id !== 'string') {
    throw new Error(`DomainSpec (${sourceHint}): 'id' is required`)
  }
  if (!obj.model || typeof obj.model !== 'string') {
    throw new Error(`DomainSpec (${sourceHint}): 'model' is required`)
  }
  if (!obj.operations || typeof obj.operations !== 'object') {
    throw new Error(`DomainSpec (${sourceHint}): 'operations' is required`)
  }

  const ops = obj.operations as Record<string, unknown>

  for (const [opName, opDef] of Object.entries(ops)) {
    if (!opDef || typeof opDef !== 'object') continue
    const op = opDef as Record<string, unknown>

    if (opName === 'list' && !op.service && !op.orderBy) {
      throw new Error(
        `DomainSpec (${sourceHint}): operations.list requires orderBy unless service delegation is set`,
      )
    }

    if (op.auth && !VALID_AUTH_POLICIES.has(op.auth as string)) {
      throw new Error(
        `DomainSpec (${sourceHint}): operation '${opName}' has invalid auth policy '${op.auth}'`,
      )
    }

    if (op.filters && typeof op.filters === 'object') {
      for (const [filterName, filterDef] of Object.entries(op.filters as Record<string, unknown>)) {
        const f = filterDef as Record<string, unknown>
        if (f.type && !VALID_FILTER_TYPES.has(f.type as string)) {
          throw new Error(
            `DomainSpec (${sourceHint}): filter '${filterName}' in '${opName}' has invalid type '${f.type}'`,
          )
        }
      }
    }
  }

  return raw as unknown as DomainSpec
}

export function loadDomainSpec(specId: string): DomainSpec {
  const cached = _cache.get(specId)
  if (cached) return cached

  const filePath = join(DOMAINS_DIR, `${specId}.yaml`)
  if (!existsSync(filePath)) {
    throw new Error(`DomainSpec not found: ${filePath}`)
  }

  const content = readFileSync(filePath, 'utf-8')
  const raw = parseYaml(content)
  const spec = validateDomainSpec(raw, filePath)
  _cache.set(specId, spec)
  return spec
}

export function resetDomainSpecCache(): void {
  _cache.clear()
}
