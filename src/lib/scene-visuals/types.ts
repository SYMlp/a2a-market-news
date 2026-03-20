/** Transition animation types for scene changes */
export type TransitionAnimation = 'door' | 'portal' | 'fade' | 'slide'

/** NPC character skin (matches PixelCharacter CharacterSkin for NPCs) */
export type SceneNpcSkin = 'receptionist' | 'editor' | 'techie'

/**
 * Per-scene layout: dock slots, plaque chrome, bubble policy.
 * See docs/scene-layout-architecture.md
 */
export interface SceneLayoutConfig {
  /** Max items shown in the app/item dock (card_deck); extra are dropped in UI */
  maxAppDockItems: number
  /** Label above the horizontal dock (e.g. 今日推荐) */
  appDockTitle: string
  /** When card dock is visible, shorten NPC bubble so list is not duplicated */
  shortNpcBubbleWhenDock: boolean
  /** Max chars for NPC bubble before ellipsis when dock is active */
  npcBubbleMaxChars: number
  /** Appended hint after truncation */
  dockBubbleHint: string
}

export interface SceneVisualConfig {
  accent: string
  accentRgb: string
  agentName: string
  agentEmoji: string
  npcSkin: SceneNpcSkin
  label: string
  icon: string
  npcGreeting: string
  bgParticleCount: number
  transitionIn: TransitionAnimation
  transitionOut: TransitionAnimation
  /** Optional; merged with defaults in getSceneLayout() */
  layout?: Partial<SceneLayoutConfig>
}
