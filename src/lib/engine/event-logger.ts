import { prisma } from '@/lib/prisma'
import { rootLogger } from '@/lib/logger'

const log = rootLogger.child({ component: 'EventLogger' })

/**
 * Bump this when deploying PA behavior fixes.
 * Used to tag session logs for before/after comparison.
 * See .cursor/rules/pa-behavior-audit.mdc §Phase 0.
 */
export const ENGINE_VERSION = '11'

// ─── Types ───────────────────────────────────────

export interface SessionLogParams {
  sessionId: string
  userId: string
  agentId?: string
  agentName?: string
  mode: string
  startScene: string
}

export interface TurnLogParams {
  sessionId: string
  userId: string
  turnNumber: number
  sceneId: string
  mode: string

  action: string
  inputContent?: string
  originalMessage?: string

  actionMatched?: string
  matchMethod?: string
  classifierConfidence?: number
  classifierSource?: string
  outcomeType?: string
  functionCallName?: string
  functionCallStatus?: string

  npcReply?: string

  transitionFrom?: string
  transitionTo?: string

  paIntent?: string
  paConfidence?: number
  paGoal?: string
  returnReason?: string

  loopDetected?: boolean
  guardType?: string
  isSubFlow?: boolean
  errorOccurred?: boolean
  errorDetail?: string

  durationMs?: number
  npcGenerateMs?: number
}

// ─── Session Logging ─────────────────────────────

/**
 * Create or update session log. Returns sessionLogId for linking turns.
 * Fire-and-forget: caller should not await in the hot path.
 */
export async function ensureSessionLog(params: SessionLogParams): Promise<string> {
  try {
    const existing = await prisma.gameSessionLog.findUnique({
      where: { sessionId: params.sessionId },
      select: { id: true },
    })
    if (existing) {
      await prisma.gameSessionLog.update({
        where: { id: existing.id },
        data: { lastActiveAt: new Date() },
      })
      return existing.id
    }

    const log = await prisma.gameSessionLog.create({
      data: {
        sessionId: params.sessionId,
        userId: params.userId,
        agentId: params.agentId,
        agentName: params.agentName,
        mode: params.mode,
        startScene: params.startScene,
        scenesVisited: [params.startScene],
        engineVersion: ENGINE_VERSION,
      },
    })
    return log.id
  } catch (err) {
    log.error({ err }, 'ensureSessionLog failed')
    return ''
  }
}

/**
 * Log a single turn. Fire-and-forget.
 */
export async function logTurn(
  sessionLogId: string,
  params: TurnLogParams,
): Promise<void> {
  if (!sessionLogId) return

  try {
    await prisma.$transaction([
      prisma.gameTurnLog.create({
        data: {
          sessionLogId,
          sessionId: params.sessionId,
          userId: params.userId,
          turnNumber: params.turnNumber,
          sceneId: params.sceneId,
          mode: params.mode,
          action: params.action,
          inputContent: params.inputContent,
          originalMessage: params.originalMessage,
          actionMatched: params.actionMatched,
          matchMethod: params.matchMethod,
          classifierConfidence: params.classifierConfidence,
          classifierSource: params.classifierSource,
          outcomeType: params.outcomeType,
          functionCallName: params.functionCallName,
          functionCallStatus: params.functionCallStatus,
          npcReply: params.npcReply,
          transitionFrom: params.transitionFrom,
          transitionTo: params.transitionTo,
          paIntent: params.paIntent,
          paConfidence: params.paConfidence,
          paGoal: params.paGoal,
          returnReason: params.returnReason,
          loopDetected: params.loopDetected ?? false,
          guardType: params.guardType,
          isSubFlow: params.isSubFlow ?? false,
          errorOccurred: params.errorOccurred ?? false,
          errorDetail: params.errorDetail,
          durationMs: params.durationMs,
          npcGenerateMs: params.npcGenerateMs,
        },
      }),
      prisma.gameSessionLog.update({
        where: { id: sessionLogId },
        data: {
          totalTurns: { increment: 1 },
          lastActiveAt: new Date(),
          ...(params.loopDetected ? { loopsDetected: { increment: 1 } } : {}),
          ...(params.errorOccurred ? { errorsOccurred: { increment: 1 } } : {}),
        },
      }),
    ])

    if (params.transitionTo) {
      await updateScenesVisited(sessionLogId, params.transitionTo)
    }
  } catch (err) {
    log.error({ err }, 'logTurn failed')
  }
}

/**
 * Mark a session log as closed with an end reason.
 */
export async function closeSessionLog(
  sessionLogId: string,
  endReason: string,
): Promise<void> {
  if (!sessionLogId) return
  try {
    await prisma.gameSessionLog.update({
      where: { id: sessionLogId },
      data: {
        lastActiveAt: new Date(),
        endReason,
      },
    })
  } catch (err) {
    log.error({ err }, 'closeSessionLog failed')
  }
}

async function updateScenesVisited(sessionLogId: string, newScene: string): Promise<void> {
  const log = await prisma.gameSessionLog.findUnique({
    where: { id: sessionLogId },
    select: { scenesVisited: true },
  })
  const visited = (log?.scenesVisited as string[]) ?? []
  if (!visited.includes(newScene)) {
    await prisma.gameSessionLog.update({
      where: { id: sessionLogId },
      data: { scenesVisited: [...visited, newScene] },
    })
  }
}
