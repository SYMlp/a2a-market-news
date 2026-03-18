import type { Scene } from '@/lib/engine/types'

const registry = new Map<string, Scene>()

export function registerScene(scene: Scene): void {
  registry.set(scene.id, scene)
}

export function getScene(id: string): Scene {
  return registry.get(id) ?? registry.get('lobby')!
}

export function listScenes(): Scene[] {
  return Array.from(registry.values())
}

export function buildSCENES(): Record<string, Scene> {
  return Object.fromEntries(registry.entries())
}
