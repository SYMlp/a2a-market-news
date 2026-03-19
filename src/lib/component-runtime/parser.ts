/**
 * ComponentSpec parser — load YAML specs and validate against meta-schema.
 *
 * Architecture: docs/component-spec-architecture.md (P7-1)
 */

import { parse as parseYaml } from 'yaml'
import Ajv, { type ValidateFunction } from 'ajv'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { ComponentSpec } from './types'

// Schema path: resolve from project root (Next.js process.cwd() at build/runtime)
const SCHEMA_PATH = join(process.cwd(), 'specs', 'componentspec.schema.json')
const SPECS_DIR = join(process.cwd(), 'specs')

let _validator: ValidateFunction | null = null

function getValidator(): ValidateFunction {
  if (_validator) return _validator
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf-8'))
  const ajv = new Ajv({ strict: false, allErrors: true })
  _validator = ajv.compile(schema)
  return _validator
}

/** Load and parse raw YAML into an object (no validation). */
export function loadYamlRaw(filePath: string): unknown {
  const content = readFileSync(filePath, 'utf-8')
  return parseYaml(content)
}

/** Load a ComponentSpec YAML file by name (e.g. 'app-settings') and validate. */
export function loadSpec(specName: string): ComponentSpec {
  const fileName = `${specName}.yaml`
  const filePath = join(SPECS_DIR, fileName)
  const raw = loadYamlRaw(filePath)
  return validateSpec(raw, filePath)
}

/** Validate a parsed object against the ComponentSpec JSON Schema. Returns typed spec or throws. */
export function validateSpec(raw: unknown, sourceHint = 'unknown'): ComponentSpec {
  const validate = getValidator()
  const valid = validate(raw)
  if (!valid) {
    const errors = validate.errors ?? []
    const msg = errors
      .map(e => `  ${e.instancePath || '/'} ${e.message}: ${JSON.stringify(e.params)}`)
      .join('\n')
    throw new Error(`ComponentSpec validation failed (${sourceHint}):\n${msg}`)
  }
  return raw as ComponentSpec
}

/** Load all 4 SubFlow specs. Useful for registration. */
export function loadAllSpecs(): ComponentSpec[] {
  const names = ['app-settings', 'profile', 'app-lifecycle', 'register']
  return names.map(name => loadSpec(name))
}
