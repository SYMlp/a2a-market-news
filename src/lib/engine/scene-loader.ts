/**
 * SceneSpec loader — load scene YAML specs and validate against JSON Schema.
 *
 * Follows the same pattern as component-runtime/parser.ts.
 * Output type is Scene (from types.ts) — consumers see no difference
 * from the old TypeScript definitions.
 */

import { parse as parseYaml } from 'yaml'
import Ajv, { type ValidateFunction } from 'ajv'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import type { Scene } from './types'

const SCHEMA_PATH = join(process.cwd(), 'specs', 'scenespec.schema.json')
const SCENES_DIR = join(process.cwd(), 'specs', 'scenes')

let _validator: ValidateFunction | null = null

function getValidator(): ValidateFunction {
  if (_validator) return _validator
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf-8'))
  const ajv = new Ajv({ strict: false, allErrors: true })
  _validator = ajv.compile(schema)
  return _validator
}

let _cache: Map<string, Scene> | null = null

/** Load a single SceneSpec YAML file and validate. */
export function loadSceneSpec(filePath: string): Scene {
  const content = readFileSync(filePath, 'utf-8')
  const raw = parseYaml(content)
  const validate = getValidator()
  const valid = validate(raw)
  if (!valid) {
    const errors = validate.errors ?? []
    const msg = errors
      .map(e => `  ${e.instancePath || '/'} ${e.message}: ${JSON.stringify(e.params)}`)
      .join('\n')
    throw new Error(`SceneSpec validation failed (${filePath}):\n${msg}`)
  }
  return raw as Scene
}

/** Load all scene specs from specs/scenes/*.yaml. Cached after first call. */
export function loadAllSceneSpecs(): Map<string, Scene> {
  if (_cache) return _cache

  _cache = new Map()
  let files: string[]
  try {
    files = readdirSync(SCENES_DIR).filter(f => f.endsWith('.yaml'))
  } catch {
    return _cache
  }

  for (const file of files) {
    const scene = loadSceneSpec(join(SCENES_DIR, file))
    _cache.set(scene.id, scene)
  }
  return _cache
}

/** Get a single scene by ID from the spec cache. Returns undefined if not found. */
export function getSceneSpec(id: string): Scene | undefined {
  return loadAllSceneSpecs().get(id)
}

/** Clear the cache (useful for tests or hot-reload scenarios). */
export function clearSceneSpecCache(): void {
  _cache = null
  _validator = null
}
