/**
 * Platform Ontology — serializes the world model into prompt text.
 *
 * Replaces buildNavigatorContext, buildScopeConstraint, and
 * buildContextualLobbyGreeting with a single source of truth:
 * platform-ontology.json → structured prompt text.
 *
 * Two views: NPC (scene-anchored) and PA (journey-aware).
 */

import ontologyData from './platform-ontology.json'
import opsData from './operational-ontology.json'
import protocolData from './communication-protocol.json'
import type {
  GameSession,
  ReturnContext,
  FCResult,
  DualText,
  SenderRole,
  MessageChannel,
  MessageMeta,
  MessageEnvelope,
} from './types'

interface SceneEntry {
  label: string
  npc: string
  role: string
  capabilities: string[]
  exits: string[]
}

interface Ontology {
  platform: string
  scenes: Record<string, SceneEntry>
  topology_rules: string[]
  capability_map: Record<string, string>
}

export interface FCRegistryEntry {
  label: string
  scene: string | null
  category: string
  requires: string | null
  produces: string | null
  failHint?: string
  npcHint: string | null
  sideEffects?: string[]
}

export interface DataLoaderEntry {
  scene: string
  provides: string[]
  meaning: string
}

export interface PreconditionEntry {
  meaning: string
  unlocks: string
}

export interface OperationalOntology {
  functionCalls: Record<string, FCRegistryEntry>
  dataLoaders: Record<string, DataLoaderEntry>
  preconditions: Record<string, PreconditionEntry>
}

export interface MessageTypeEntry {
  sender: string
  channel: string
  description: string
  metaFields?: string[]
}

export interface NPCDecisionProtocol {
  intentRecognition: string
  dataConsumption: Record<string, string>
  sceneTransition: string
  responseRules: string[]
}

export interface CommunicationProtocol {
  messageTypes: Record<string, MessageTypeEntry>
  npcDecisionProtocols: Record<string, NPCDecisionProtocol>
  paOutputProtocol: Record<string, unknown>
}

const ontology: Ontology = ontologyData as Ontology
const operationalOntology: OperationalOntology = opsData as unknown as OperationalOntology
const communicationProtocol: CommunicationProtocol = protocolData as unknown as CommunicationProtocol

export function getOntology(): Ontology {
  return ontology
}

export function getOperationalOntology(): OperationalOntology {
  return operationalOntology
}

export function getCommunicationProtocol(): CommunicationProtocol {
  return communicationProtocol
}

export function getSceneLabel(sceneId: string): string {
  return ontology.scenes[sceneId]?.label ?? sceneId
}

/**
 * Generates a rich NPC-facing description of a function call result,
 * combining the operational ontology registry entry with the actual
 * FCResult from execution. Replaces bare "操作执行结果：xxx" strings.
 */
export function describeFCForNPC(fcResult: FCResult): string {
  const entry = operationalOntology.functionCalls[fcResult.name]
  if (!entry) {
    if (fcResult.status === 'executed') {
      return `操作执行结果：${fcResult.name} 执行成功${fcResult.detail ? `\n- ${fcResult.detail}` : ''}`
    }
    return `操作执行结果：${fcResult.name} 未执行${fcResult.detail ? `\n- 原因：${fcResult.detail}` : ''}`
  }

  const parts: string[] = []
  if (fcResult.status === 'executed') {
    parts.push(`「${entry.label}」执行成功`)
    if (entry.produces) parts.push(`效果：${entry.produces}`)
    if (fcResult.detail) parts.push(`详情：${fcResult.detail}`)
    if (entry.sideEffects?.length) parts.push(`附带：${entry.sideEffects.join('、')}`)
    if (entry.npcHint) parts.push(`提示：${entry.npcHint}`)
  } else {
    parts.push(`「${entry.label}」未执行`)
    if (fcResult.detail) parts.push(`原因：${fcResult.detail}`)
    else if (entry.failHint) parts.push(`原因：${entry.failHint}`)
  }
  return parts.join('\n- ')
}

/**
 * Wraps a DualText into a MessageEnvelope at the API boundary.
 * Internal engine functions keep using DualText; this helper is called
 * in process/route.ts and pa-respond/route.ts before returning JSON.
 */
export function toEnvelope(
  dt: DualText,
  sender: SenderRole,
  channel: MessageChannel,
  meta?: MessageMeta,
): MessageEnvelope {
  return { ...dt, sender, channel, meta }
}

/**
 * NPC view: tells the NPC about its own scene, exits, and what other scenes can do.
 * Injected into NPC system prompt so it never gives impossible navigation advice.
 */
export function serializeForNPC(sceneId: string): string {
  const scene = ontology.scenes[sceneId]
  if (!scene) return ''

  const parts: string[] = []
  parts.push('== 平台地图 ==')
  parts.push(`你所在的场景：${scene.label}`)
  parts.push(`你的能力：${scene.capabilities.join('、')}`)

  const exitLabels = scene.exits.map(e => ontology.scenes[e]?.label || e)
  parts.push(`出口：${exitLabels.join('、')}`)

  const otherScenes = Object.entries(ontology.scenes)
    .filter(([id]) => id !== sceneId)
  if (otherScenes.length > 0) {
    parts.push('')
    parts.push('其他场景（你不负责，但可以告诉访客去哪里找）：')
    for (const [id, s] of otherScenes) {
      const via = scene.exits.includes(id) ? '直达' : `经${exitLabels[0]}`
      parts.push(`- ${s.label}（${s.npc}）：${s.capabilities.join('、')} [${via}]`)
    }
  }

  parts.push('')
  parts.push('导航规则：')
  for (const rule of ontology.topology_rules) {
    parts.push(`- ${rule}`)
  }
  if (!scene.exits.includes('lobby') && sceneId !== 'lobby') {
    parts.push(`- 访客想去其他场景时，引导他"回大厅"。不要说"去XX"，要说"回大厅后可以去XX"。`)
  }

  const capEntries = Object.entries(ontology.capability_map)
  if (capEntries.length > 0) {
    parts.push('')
    parts.push('访客想做的事 → 对应场景：')
    for (const [desire, targetSceneId] of capEntries) {
      const targetLabel = ontology.scenes[targetSceneId]?.label ?? targetSceneId
      const tag = targetSceneId === sceneId ? '本场景' : targetLabel
      parts.push(`- ${desire} → ${tag}`)
    }
  }

  return parts.join('\n')
}

/**
 * Protocol view: tells the NPC how the communication machinery works.
 * Reads npcDecisionProtocols from communication-protocol.json and selects
 * the protocol matching the NPC's role (navigator for lobby, scene_host otherwise).
 */
export function serializeProtocolForNPC(sceneId: string): string {
  const scene = ontology.scenes[sceneId]
  if (!scene) return ''

  const roleKey = sceneId === 'lobby' ? 'navigator' : 'scene_host'
  const protocol = communicationProtocol.npcDecisionProtocols[roleKey]
  if (!protocol) return ''

  const parts: string[] = []
  parts.push('== 决策协议 ==')
  parts.push(`你的意图识别：${protocol.intentRecognition}`)

  const dataLines = Object.entries(protocol.dataConsumption)
    .map(([key, desc]) => `${key}：${desc}`)
  parts.push(`你的数据来源：${dataLines.join('；')}。`)

  parts.push(`场景切换方式：${protocol.sceneTransition}`)

  parts.push('行为准则：')
  for (const rule of protocol.responseRules) {
    parts.push(`- ${rule}`)
  }

  return parts.join('\n')
}

/**
 * PA view: tells the PA about the whole platform map + its journey history.
 * Replaces buildJourneySummary + buildNavigatorContext.
 */
export function serializeForPA(session: GameSession): string {
  const visited = (session.flags?.visitedScenes ?? []) as string[]
  const events = (session.flags?.recentEvents ?? []) as string[]
  const returnCtx = session.flags?.returnContext as ReturnContext | undefined
  const goal = session.flags?.currentGoal as { purpose: string } | undefined

  const parts: string[] = []
  parts.push('== 平台地图 ==')

  for (const [id, scene] of Object.entries(ontology.scenes)) {
    const exits = scene.exits.map(e => ontology.scenes[e]?.label || e).join('、')
    const visitTag = visited.includes(id) ? '✓已去过' : '✗还没去过'
    parts.push(`- ${scene.label}（${scene.npc}）→ 出口: ${exits} | 能力: ${scene.capabilities.join('、')} [${visitTag}]`)
  }
  parts.push(`路线：场景之间不能直达，必须经过大厅。`)

  const capEntries = Object.entries(ontology.capability_map)
  if (capEntries.length > 0) {
    parts.push('')
    parts.push('你能做的事 → 去哪里：')
    for (const [desire, targetSceneId] of capEntries) {
      const targetLabel = ontology.scenes[targetSceneId]?.label ?? targetSceneId
      parts.push(`- ${desire} → ${targetLabel}`)
    }
  }

  if (events.length > 0 || returnCtx || goal) {
    parts.push('')
    parts.push('== 你的旅程 ==')
    if (events.length > 0) {
      const recent = events.slice(-6)
      recent.forEach((e, i) => parts.push(`${i + 1}. ${e}`))
    }
    if (returnCtx) {
      const fromLabel = ontology.scenes[returnCtx.fromScene]?.label || returnCtx.fromScene
      parts.push(`→ 你刚从${fromLabel}回来：${returnCtx.summary}`)
    }
    if (goal) {
      parts.push(`→ 你的目标：${goal.purpose}`)
    }
  }

  const notVisited = Object.entries(ontology.scenes)
    .filter(([id]) => !visited.includes(id))
    .map(([, s]) => s.label)
  if (notVisited.length > 0) {
    parts.push(`→ 还没去过：${notVisited.join('、')}`)
  }

  const experiencingApp = session.flags?.experiencingApp as { name: string } | undefined
  const hasExperienced = !!session.flags?.hasExperienced
  const subFlow = session.flags?.subFlow as { type: string } | undefined

  if (experiencingApp || subFlow) {
    parts.push('')
    parts.push('== 当前状态 ==')
    if (experiencingApp) {
      parts.push(`- 你正在体验「${experiencingApp.name}」— 体验已开始，下一步应该是提交体验报告`)
    }
    if (subFlow) {
      parts.push(`- 你正在进行「${subFlow.type}」流程，请继续完成当前步骤`)
    }
  } else if (hasExperienced) {
    parts.push('')
    parts.push('== 当前状态 ==')
    parts.push('- 你已完成应用体验，可以提交体验报告')
  }

  return parts.join('\n')
}
