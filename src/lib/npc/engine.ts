import { prisma } from '../prisma'
import { refreshAccessToken } from '../auth'
import { callSecondMeStream } from '../pa-engine'
import { buildNPCMessage, buildAgentText, NPC_SEEDS } from './prompts'
// v7: scope gate disabled — ontology handles scope via prompt
// import { buildScopeConstraint, checkScopeAndRedirect } from './scope'
import { fillTemplate } from '@/lib/engine/template'
import { resolveOpening } from '@/lib/engine/game-loop'
import { serializeForNPC, serializeProtocolForNPC } from '@/lib/engine/ontology'
import { MODEL_FOR } from '@/lib/model-config'
import type { DualText, TurnOutcome } from '@/lib/engine/types'
import type { NPCReplyContext, NPCReplyResult } from './types'
import { getScene } from '@/lib/scenes'

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
): Promise<NPCReplyResult> {
  const npcKey = resolveNPCKey(context.sceneId)
  const scene = getScene(context.sceneId)

  const isFirstVisit = context.entryType === 'first'
  const fallbackMessage: DualText = context.outcome
    ? context.outcome.message
    : context.entryType
      ? fillTemplate(resolveOpening(scene, isFirstVisit), context.sceneData)
      : fillTemplate(scene.fallback.response, context.sceneData)

  // v7: scope gate disabled — ontology in prompt handles scope naturally
  // If re-enabling, use meta instead of the removed _scopeRedirect boolean:
  //   return { ...scopeResult.redirectMessage, meta: { scopeAssessment: 'redirect' } }

  const npc = await prisma.nPC.findUnique({
    where: { key: npcKey },
  })

  if (!npc?.ownerId || !npc.isActive) {
    return { ...fallbackMessage, meta: { scopeAssessment: 'in_scope' } }
  }

  const token = await getOwnerToken(npc.ownerId)
  if (!token) {
    return { ...fallbackMessage, meta: { scopeAssessment: 'in_scope' } }
  }

  try {
    const message = buildNPCMessage({
      sceneId: context.sceneId,
      actions: scene.actions,
      sceneData: context.sceneData,
      visitorMessage: context.visitorMessage,
      visitorName: context.visitorInfo?.name,
      outcomeDescription: context.outcome
        ? describeOutcome(context.outcome)
        : context.entryType === 'first'
          ? '访客第一次来到这个场景。请用欢迎开场白，适度自我介绍。'
          : context.entryType === 'return'
            ? '访客回到了这个场景（之前来过）。不要重复欢迎词和自我介绍，结合旅程记忆给出回应。'
            : undefined,
      isFreeChat: context.isFreeChat,
      sessionContext: context.sessionContext,
      entryType: context.entryType,
    })

    const ontologyContext = serializeForNPC(context.sceneId)
    const protocolContext = serializeProtocolForNPC(context.sceneId)
    const promptParts = [npc.systemPrompt, ontologyContext, protocolContext].filter(Boolean)
    const systemPrompt = promptParts.join('\n\n')

    const aiReply = await callSecondMeStream(
      '/api/secondme/chat/stream',
      token,
      {
        message,
        systemPrompt,
        model: MODEL_FOR.npcDialogue,
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
      meta: { scopeAssessment: 'in_scope' },
    }
  } catch (e) {
    console.error(`NPC AI generation failed for ${npcKey}:`, e)
    return { ...fallbackMessage, meta: { scopeAssessment: 'in_scope' } }
  }
}

export async function getNPCForScene(sceneId: string) {
  const npcKey = resolveNPCKey(sceneId)
  return prisma.nPC.findUnique({ where: { key: npcKey } })
}
