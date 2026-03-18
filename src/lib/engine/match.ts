import type { SceneAction, PlayerTurn } from './types'
import { getScene } from '@/lib/scenes'

export function matchAction(actions: SceneAction[], message: string): SceneAction | null {
  const lower = message.toLowerCase()
  for (const action of actions) {
    for (const trigger of action.triggers ?? []) {
      if (lower.includes(trigger.toLowerCase())) {
        return action
      }
    }
  }
  return null
}

export function extractTurn(message: string, sceneId: string): PlayerTurn {
  const scene = getScene(sceneId)
  const matched = matchAction(scene.actions, message)
  if (matched) {
    return { type: 'act', actionId: matched.id }
  }
  return { type: 'act', actionId: '_fallback' }
}
