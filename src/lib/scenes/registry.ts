import type { Scene } from '@/lib/engine/types'
import { loadAllSceneSpecs } from '@/lib/engine/scene-loader'

let _loaded = false

function ensureLoaded(): Map<string, Scene> {
  const specs = loadAllSceneSpecs()
  if (!_loaded && specs.size > 0) _loaded = true
  return specs
}

export function getScene(id: string): Scene {
  const specs = ensureLoaded()
  return specs.get(id) ?? specs.get('lobby')!
}

export function listScenes(): Scene[] {
  return Array.from(ensureLoaded().values())
}

export function buildSCENES(): Record<string, Scene> {
  return Object.fromEntries(ensureLoaded().entries())
}
