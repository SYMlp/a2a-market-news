import { prisma } from '../prisma'
import { refreshAccessToken } from '../auth'
import { callSecondMeStream } from '../pa-engine'
import { buildNPCMessage, buildAgentText } from './npc-prompts'
import type { DualText, TurnOutcome } from './types'
import { getScene } from './scenes'

interface VisitorInfo {
  name?: string
  type: 'pa' | 'agent'
}

interface NPCReplyContext {
  sceneId: string
  visitorMessage?: string
  outcome?: TurnOutcome
  sceneData?: Record<string, unknown>
  visitorInfo?: VisitorInfo
  isOpening?: boolean
  isFreeChat?: boolean
}

async function getOwnerToken(ownerId: string): Promise<string | null> {
  const owner = await prisma.user.findUnique({ where: { id: ownerId } })
  if (!owner) return null

  if (owner.tokenExpiresAt < new Date()) {
    try {
      const tokens = await refreshAccessToken(owner.refreshToken)
      await prisma.user.update({
        where: { id: ownerId },
        data: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        },
      })
      return tokens.access_token
    } catch (e) {
      console.error(`NPC owner token refresh failed for ${ownerId}:`, e)
      return null
    }
  }

  return owner.accessToken
}

function resolveNPCKey(sceneId: string): string {
  if (sceneId === 'lobby') return 'gm'
  const sceneNPCs: Record<string, string> = { news: 'editor', developer: 'tech-advisor' }
  return sceneNPCs[sceneId] || 'gm'
}

function describeOutcome(outcome: TurnOutcome): string {
  if (outcome.type === 'stay') {
    return '访客的操作结果：留在当前场景。'
  }
  return `访客将要前往「${outcome.target}」场景。`
}

export async function generateNPCReply(
  context: NPCReplyContext,
): Promise<DualText> {
  const npcKey = resolveNPCKey(context.sceneId)
  const scene = getScene(context.sceneId)

  const fallbackMessage: DualText = context.outcome
    ? context.outcome.message
    : context.isOpening
      ? scene.opening
      : scene.fallback.response

  const npc = await prisma.nPC.findUnique({
    where: { key: npcKey },
  })

  if (!npc?.ownerId || !npc.isActive) return fallbackMessage

  const token = await getOwnerToken(npc.ownerId)
  if (!token) return fallbackMessage

  try {
    const message = buildNPCMessage({
      sceneId: context.sceneId,
      actions: scene.actions,
      sceneData: context.sceneData,
      visitorMessage: context.visitorMessage,
      visitorName: context.visitorInfo?.name,
      outcomeDescription: context.outcome
        ? describeOutcome(context.outcome)
        : context.isOpening
          ? '这是访客刚进入场景的开场白。'
          : undefined,
      isFreeChat: context.isFreeChat,
    })

    const aiReply = await callSecondMeStream(
      '/api/secondme/chat/stream',
      token,
      {
        message,
        systemPrompt: npc.systemPrompt,
      },
    )

    const actionId = context.outcome?.type === 'stay'
      ? (context.outcome as { effect: { functionCall: { name: string } } }).effect?.functionCall?.name
      : undefined
    const transitionTarget = context.outcome?.type === 'move'
      ? (context.outcome as { target: string }).target
      : undefined

    return {
      pa: aiReply || fallbackMessage.pa,
      agent: buildAgentText(
        context.outcome?.type || 'stay',
        context.sceneId,
        actionId,
        transitionTarget,
      ),
    }
  } catch (e) {
    console.error(`NPC AI generation failed for ${npcKey}:`, e)
    return fallbackMessage
  }
}

export async function getNPCForScene(sceneId: string) {
  const npcKey = resolveNPCKey(sceneId)
  return prisma.nPC.findUnique({ where: { key: npcKey } })
}
