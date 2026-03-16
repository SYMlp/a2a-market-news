import type { CharacterSkin } from '@/components/scene/PixelCharacter'

export interface SceneVisualConfig {
  accent: string
  accentRgb: string
  agentName: string
  agentEmoji: string
  npcSkin: CharacterSkin
  label: string
  icon: string
  npcGreeting: string
  bgParticleCount: number
}

export const SCENE_CONFIG: Record<string, SceneVisualConfig> = {
  lobby: {
    accent: '#00d2ff',
    accentRgb: '0,210,255',
    agentName: '灵枢兔',
    agentEmoji: '🐰',
    npcSkin: 'receptionist',
    label: '大厅',
    icon: '🏛️',
    npcGreeting: '欢迎来到 A2A 智选日报！',
    bgParticleCount: 20,
  },
  news: {
    accent: '#ffb020',
    accentRgb: '255,176,32',
    agentName: '编辑部助手',
    agentEmoji: '📰',
    npcSkin: 'editor',
    label: '日报栏',
    icon: '📰',
    npcGreeting: '欢迎来到日报栏！',
    bgParticleCount: 25,
  },
  developer: {
    accent: '#a855f7',
    accentRgb: '168,85,247',
    agentName: '技术顾问',
    agentEmoji: '🛠️',
    npcSkin: 'techie',
    label: '开发者空间',
    icon: '🛠️',
    npcGreeting: '欢迎来到开发者空间！',
    bgParticleCount: 18,
  },
}
