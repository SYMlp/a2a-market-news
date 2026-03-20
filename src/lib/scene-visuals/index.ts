import type { SceneVisualConfig, SceneLayoutConfig } from './types'
import configs from './configs.json'

export type { SceneVisualConfig, SceneLayoutConfig, TransitionAnimation, SceneNpcSkin } from './types'

/** Scene visual configs keyed by scene id */
export const SCENE_CONFIG: Record<string, SceneVisualConfig> = configs as Record<
  string,
  SceneVisualConfig
>

const DEFAULT_LAYOUT: SceneLayoutConfig = {
  maxAppDockItems: 6,
  appDockTitle: '可选条目',
  shortNpcBubbleWhenDock: true,
  npcBubbleMaxChars: 160,
  dockBubbleHint: '（详情见下方物品栏）',
}

/** Resolved layout for a scene (for dock, plaque policy) */
export function getSceneLayout(sceneId: string): SceneLayoutConfig {
  const cfg = SCENE_CONFIG[sceneId]
  if (!cfg?.layout) return { ...DEFAULT_LAYOUT }
  return { ...DEFAULT_LAYOUT, ...cfg.layout }
}
