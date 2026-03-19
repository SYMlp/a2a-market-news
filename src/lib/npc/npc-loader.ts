/**
 * NPC spec loader — load NPC YAML specs from specs/npcs/*.yaml.
 *
 * Follows the same caching pattern as scene-loader.ts.
 * Output type is NPCSeedData[] — consumers see no difference
 * from the old hardcoded NPC_SEEDS array.
 */

import { parse as parseYaml } from 'yaml'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import type { NPCSeedData } from './types'

const NPCS_DIR = join(process.cwd(), 'specs', 'npcs')

let _cache: NPCSeedData[] | null = null

/** Load a single NPC spec YAML file and return as NPCSeedData. */
export function loadNPCSpec(filePath: string): NPCSeedData {
  const content = readFileSync(filePath, 'utf-8')
  const raw = parseYaml(content) as Record<string, unknown>

  const required = ['key', 'name', 'emoji', 'role', 'accent', 'systemPrompt', 'scope'] as const
  for (const field of required) {
    if (raw[field] === undefined) {
      throw new Error(`NPC spec missing required field '${field}' in ${filePath}`)
    }
  }

  const role = raw.role as string
  if (role !== 'gm' && role !== 'scene_host') {
    throw new Error(`NPC spec has invalid role '${role}' in ${filePath} (must be 'gm' or 'scene_host')`)
  }

  return {
    key: raw.key as string,
    name: raw.name as string,
    emoji: raw.emoji as string,
    role: role as 'gm' | 'scene_host',
    sceneId: (raw.sceneId as string | null) ?? null,
    accent: raw.accent as string,
    systemPrompt: (raw.systemPrompt as string).trimEnd(),
    scope: raw.scope as string[],
  }
}

/** Load all NPC specs from specs/npcs/*.yaml. Cached after first call. */
export function loadAllNPCSpecs(): NPCSeedData[] {
  if (_cache) return _cache

  let files: string[]
  try {
    files = readdirSync(NPCS_DIR).filter(f => f.endsWith('.yaml'))
  } catch {
    _cache = []
    return _cache
  }

  _cache = files.map(file => loadNPCSpec(join(NPCS_DIR, file)))
  return _cache
}

/** Get a single NPC spec by key. Returns undefined if not found. */
export function getNPCSpec(key: string): NPCSeedData | undefined {
  return loadAllNPCSpecs().find(npc => npc.key === key)
}

/** Clear the cache (useful for tests or hot-reload scenarios). */
export function clearNPCSpecCache(): void {
  _cache = null
}
