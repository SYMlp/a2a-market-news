import type { SceneVisualConfig } from './types'
import configs from './configs.json'

export type { SceneVisualConfig, TransitionAnimation, SceneNpcSkin } from './types'

/** Scene visual configs keyed by scene id */
export const SCENE_CONFIG: Record<string, SceneVisualConfig> = configs as Record<
  string,
  SceneVisualConfig
>
