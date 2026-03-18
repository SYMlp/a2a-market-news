/** Transition animation types for scene changes */
export type TransitionAnimation = 'door' | 'portal' | 'fade' | 'slide'

/** NPC character skin (matches PixelCharacter CharacterSkin for NPCs) */
export type SceneNpcSkin = 'receptionist' | 'editor' | 'techie'

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
}
