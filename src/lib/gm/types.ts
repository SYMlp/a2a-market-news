/* GM Script Engine — shared types */

export interface DualText {
  pa: string
  agent: string
}

export interface SceneOption {
  id: string
  triggers: string[]
  actIntent?: string
  response: DualText
  functionCall: {
    name: string
    args: Record<string, unknown>
  }
  transition: SceneTransition
}

export interface SceneTransition {
  type: 'enter_space' | 'sub_flow' | 'external' | 'hub'
  target?: string
}

export interface Scene {
  id: string
  maxRounds: 1 | 2
  opening: DualText
  dataLoader?: string
  options: SceneOption[]
  fallback: {
    response: DualText
    action: 'retry' | 'hub'
  }
  theme: {
    accent: string
    icon: string
    label: string
  }
}

export interface GMSession {
  id: string
  currentScene: string
  round: number
  mode: 'manual' | 'auto'
  agentId?: string
  agentName?: string
  data?: Record<string, unknown>
  createdAt: number
  lastActiveAt: number
}

export interface GMResponse {
  message: DualText
  currentScene: string
  sessionId: string
  data?: Record<string, unknown>
  availableActions?: Array<{
    action: string
    description: string
    params?: Record<string, string>
  }>
  functionCall?: {
    name: string
    args: Record<string, unknown>
    status: 'pending' | 'executed'
  }
  sceneTransition?: {
    from: string
    to: string
    type: SceneTransition['type']
  }
}
