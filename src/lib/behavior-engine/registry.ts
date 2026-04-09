/**
 * Behavior Engine — Spec Registry
 *
 * Loads BehaviorSpec YAML files from specs/behaviors/, validates structure,
 * and provides indexed lookup by scene, trigger, and ID.
 *
 * Does NOT load legacy SubFlow specs from specs/ — those continue through
 * the existing component-runtime/parser.ts path.
 *
 * Architecture: docs/behavior-spec-architecture.md §4
 */

import { parse as parseYaml } from 'yaml'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import Ajv from 'ajv'
import type { BehaviorSpec, ResolutionType } from './types'

const BEHAVIORS_DIR = join(process.cwd(), 'specs', 'behaviors')
const SCHEMA_PATH = join(process.cwd(), 'specs', 'behaviorspec.schema.json')

let _schemaValidate: ReturnType<Ajv['compile']> | null = null

function getSchemaValidator(): ReturnType<Ajv['compile']> | null {
  if (_schemaValidate !== undefined && _schemaValidate !== null) return _schemaValidate
  try {
    if (!existsSync(SCHEMA_PATH)) return null
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf-8'))
    const ajv = new Ajv({ allErrors: true, strict: false })
    _schemaValidate = ajv.compile(schema)
    return _schemaValidate
  } catch {
    return null
  }
}

const VALID_RESOLUTION_TYPES: ReadonlySet<string> = new Set<ResolutionType>([
  'select_one',
  'subflow',
  'free_response',
  'navigate',
])

// ─── Validation ──────────────────────────────────

function isBehaviorFormat(raw: unknown): raw is Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return false
  const obj = raw as Record<string, unknown>
  return 'availability' in obj && 'resolution' in obj
}

function validateBehaviorSpec(raw: unknown, sourceHint: string): BehaviorSpec {
  if (!isBehaviorFormat(raw)) {
    throw new Error(
      `Not a BehaviorSpec (${sourceHint}): missing 'availability' or 'resolution'. ` +
        `Legacy SubFlow specs belong in specs/, not specs/behaviors/.`,
    )
  }

  const obj = raw as Record<string, unknown>

  if (!obj.id || typeof obj.id !== 'string') {
    throw new Error(`BehaviorSpec validation failed (${sourceHint}): 'id' is required and must be a string`)
  }

  const availability = obj.availability as Record<string, unknown> | undefined
  if (!availability?.scenes || !Array.isArray(availability.scenes) || availability.scenes.length === 0) {
    throw new Error(`BehaviorSpec validation failed (${sourceHint}): 'availability.scenes' must be a non-empty array`)
  }

  if (!availability.trigger || typeof availability.trigger !== 'object') {
    throw new Error(`BehaviorSpec validation failed (${sourceHint}): 'availability.trigger' is required`)
  }

  const resolution = obj.resolution as Record<string, unknown> | undefined
  if (!resolution?.type || !VALID_RESOLUTION_TYPES.has(resolution.type as string)) {
    throw new Error(
      `BehaviorSpec validation failed (${sourceHint}): 'resolution.type' must be one of: ${Array.from(VALID_RESOLUTION_TYPES).join(', ')}`,
    )
  }

  const schemaValidator = getSchemaValidator()
  if (schemaValidator && !schemaValidator(raw)) {
    const errors = schemaValidator.errors?.map(e => `${e.instancePath || '/'} ${e.message}`).join('; ')
    throw new Error(`BehaviorSpec schema validation failed (${sourceHint}): ${errors}`)
  }

  return raw as unknown as BehaviorSpec
}

// ─── Registry ────────────────────────────────────

let _specs: Map<string, BehaviorSpec> | null = null
let _byScene: Map<string, BehaviorSpec[]> | null = null
let _byTrigger: Map<string, BehaviorSpec> | null = null

function buildIndexes(specs: Map<string, BehaviorSpec>): void {
  _byScene = new Map()
  _byTrigger = new Map()

  for (const spec of Array.from(specs.values())) {
    for (const sceneId of spec.availability.scenes) {
      const list = _byScene.get(sceneId) ?? []
      list.push(spec)
      _byScene.set(sceneId, list)
    }

    if (spec.availability.trigger.onFunctionCall) {
      _byTrigger.set(spec.availability.trigger.onFunctionCall, spec)
    }
  }
}

/**
 * Load all BehaviorSpec YAML files from specs/behaviors/.
 * Results are cached — call once at startup.
 */
export function loadBehaviorSpecs(): Map<string, BehaviorSpec> {
  if (_specs) return _specs

  _specs = new Map()

  if (!existsSync(BEHAVIORS_DIR)) {
    buildIndexes(_specs)
    return _specs
  }

  const files = readdirSync(BEHAVIORS_DIR).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))

  for (const file of files) {
    const filePath = join(BEHAVIORS_DIR, file)
    const content = readFileSync(filePath, 'utf-8')
    const raw = parseYaml(content)
    const spec = validateBehaviorSpec(raw, filePath)
    _specs.set(spec.id, spec)
  }

  buildIndexes(_specs)
  return _specs
}

/**
 * Get all behavior specs available in a given scene.
 */
export function getBehaviorsForScene(sceneId: string): BehaviorSpec[] {
  if (!_byScene) loadBehaviorSpecs()
  return _byScene!.get(sceneId) ?? []
}

/**
 * Get the behavior spec triggered by a specific function call name.
 */
export function getBehaviorByTrigger(fcName: string): BehaviorSpec | undefined {
  if (!_byTrigger) loadBehaviorSpecs()
  return _byTrigger!.get(fcName)
}

/**
 * Get a behavior spec by its ID.
 */
export function getBehaviorById(id: string): BehaviorSpec | undefined {
  if (!_specs) loadBehaviorSpecs()
  return _specs!.get(id)
}

/**
 * Reset the registry cache. Useful for testing or hot-reload.
 */
export function resetBehaviorRegistry(): void {
  _specs = null
  _byScene = null
  _byTrigger = null
}
