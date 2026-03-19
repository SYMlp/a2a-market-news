import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getOrCreateSession, enterSceneWithAI, processMessageWithAI, generateNPCReplyForTurn, persistSession } from '@/lib/gm/engine'
import { endSession } from '@/lib/engine/session'
import { recordEvent, getCurrentGoal, setReturnContext, recordAchievement, computeReturnContext, incrementSceneTurns, resetSceneTurns } from '@/lib/engine/session-context'
import { recordTransitionAndCheck, checkActionRepeat } from '@/lib/engine/conversation-guard'
import { getScene } from '@/lib/scenes'
import {
  routeSubFlow,
  routeSubFlowConfirm,
  cancelSubFlow,
} from '@/lib/subflow/router'
import { executeFunctionCall } from '@/lib/gm/function-call-executor'
import { ensureSessionLog, logTurn, closeSessionLog } from '@/lib/engine/event-logger'
import type { GameSession, FCResult } from '@/lib/engine/types'
import { getSceneLabel, getOntology, toEnvelope } from '@/lib/engine/ontology'
import { buildSessionSummary, buildPreconditionState, loadSceneData } from '@/lib/gm/route-utils'
import { processBehavior, buildBehaviorPresentation, serializePresentation } from '@/lib/behavior-engine'

/**
 * POST /api/gm/process
 * Core GM conversation endpoint for Web mode.
 * Handles: entering scenes, processing PA messages, scene transitions,
 * executing side-effect function calls, and registration sub-flow.
 */
export async function POST(request: NextRequest) {
  const turnStart = Date.now()
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const body = await request.json()
    const { message, sessionId, action, originalMessage } = body as {
      message?: string
      sessionId?: string
      action?: 'enter' | 'message' | 'subflow_confirm' | 'subflow_cancel'
      originalMessage?: string
    }

    const mode = body.mode || 'manual'
    const session = getOrCreateSession(sessionId, mode)

    const sessionLogId = await ensureSessionLog({
      sessionId: session.id,
      userId: user.id,
      agentId: session.agentId,
      agentName: session.agentName ?? user.name ?? undefined,
      mode,
      startScene: session.currentScene,
    })

    // ─── SubFlow confirm: handler-specific confirmation ───
    if (action === 'subflow_confirm') {
      logTurn(sessionLogId, {
        sessionId: session.id,
        userId: user.id,
        turnNumber: session.globalTurn,
        sceneId: session.currentScene,
        mode,
        action: 'subflow_confirm',
        inputContent: JSON.stringify(body.args ?? {}),
        isSubFlow: true,
        outcomeType: 'stay',
        durationMs: Date.now() - turnStart,
      }).catch(() => {})

      return routeSubFlowConfirm(session, body.args ?? {}, user, request)
    }

    // ─── SubFlow cancel: clear server-side subflow state ───
    if (action === 'subflow_cancel') {
      const hadSubFlow = cancelSubFlow(session)
      logTurn(sessionLogId, {
        sessionId: session.id,
        userId: user.id,
        turnNumber: session.globalTurn,
        sceneId: session.currentScene,
        mode,
        action: 'subflow_cancel',
        isSubFlow: true,
        outcomeType: 'stay',
        durationMs: Date.now() - turnStart,
      }).catch(() => {})

      return NextResponse.json({
        success: true,
        message: toEnvelope(
          {
            pa: hadSubFlow ? '好的，已取消。还想做什么？' : '没有进行中的操作。',
            agent: hadSubFlow ? 'SubFlow cancelled.' : 'No active subflow.',
          },
          'system',
          'public',
        ),
        currentScene: session.currentScene,
        sessionId: session.id,
      })
    }

    // ─── Enter scene ───
    if (action === 'enter' || !sessionId) {
      const sceneId = body.sceneId || 'lobby'
      const scene = getScene(sceneId)

      // Clear any active subflow when entering a new scene
      if (session.flags?.subFlow) {
        session.flags = { ...session.flags, subFlow: undefined }
        persistSession(session)
      }

      // Navigator exhaustion: count lobby re-entries
      if (sceneId === 'lobby') {
        const visited = (session.flags?.visitedScenes ?? []) as string[]
        if (visited.length > 0) {
          const attempts = ((session.flags?.navigatorAttempts as number) ?? 0) + 1
          session.flags = { ...session.flags, navigatorAttempts: attempts }
          persistSession(session)

          if (attempts >= 3) {
            endSession(session, 'navigator_exhausted')
            closeSessionLog(sessionLogId, 'navigator_exhausted').catch(() => {})

            const farewellDT = {
              pa: '看起来今天没找到你想要的，没关系，下次再来逛逛吧！我们随时欢迎你～',
              agent: '[NAVIGATOR_EXHAUSTED] PA returned to lobby 3+ times without successful navigation. Session ended.',
            }
            const farewell = toEnvelope(farewellDT, 'system', 'public')

            logTurn(sessionLogId, {
              sessionId: session.id,
              userId: user.id,
              turnNumber: session.globalTurn,
              sceneId,
              mode,
              action: 'enter',
              paGoal: getCurrentGoal(session)?.purpose,
              returnReason: 'navigator_exhausted',
              outcomeType: 'stay',
              durationMs: Date.now() - turnStart,
            }).catch(() => {})

            return NextResponse.json({
              success: true,
              message: farewell,
              currentScene: 'lobby',
              sessionId: session.id,
              sessionEnded: true,
              summary: buildSessionSummary(session),
            })
          }
        }
      }

      let sceneData: Record<string, unknown> | undefined

      if (scene.dataLoader) {
        sceneData = await loadSceneData(scene.dataLoader, request, user.id)
      }

      const wasVisited = ((session.flags?.visitedScenes ?? []) as string[]).includes(sceneId)
      const visitorInfo = { name: user.name || undefined, type: 'pa' as const }
      const response = await enterSceneWithAI(session, sceneId, sceneData, visitorInfo)

      const npcText = response.message?.pa || ''
      const sceneName = getSceneLabel(sceneId)
      recordEvent(session, `进入「${sceneName}」，NPC 说：${npcText.slice(0, 60)}`)
      resetSceneTurns(session)

      if (sceneId !== 'lobby' && !wasVisited) {
        recordAchievement(session, {
          sceneId,
          actionId: 'explore',
          label: `探索了${sceneName}`,
        })
      }
      persistSession(session)

      logTurn(sessionLogId, {
        sessionId: session.id,
        userId: user.id,
        turnNumber: session.globalTurn,
        sceneId,
        mode,
        action: 'enter',
        npcReply: npcText,
        paGoal: getCurrentGoal(session)?.purpose,
        outcomeType: response.sceneTransition ? 'move' : 'stay',
        transitionFrom: response.sceneTransition?.from,
        transitionTo: response.sceneTransition?.to,
        durationMs: Date.now() - turnStart,
      }).catch(() => {})

      const enterEnvelope = response.message
        ? toEnvelope(response.message, 'npc', 'public')
        : response.message
      return NextResponse.json({
        success: true,
        ...response,
        message: enterEnvelope,
        preconditionState: buildPreconditionState(sceneData, session),
        behaviorPresentation: serializePresentation(buildBehaviorPresentation(session)),
      })
    }

    if (!message) {
      return NextResponse.json({ error: '缺少 message' }, { status: 400 })
    }

    // ─── SubFlow: intercept messages while any sub-flow is active ───
    // In advisor mode, originalMessage carries the human's raw input (e.g. a UUID),
    // which SubFlow needs instead of the PA's formulated response.
    const subFlowInput = originalMessage || message
    const subFlowResult = await routeSubFlow(session, subFlowInput, user)
    if (subFlowResult) {
      logTurn(sessionLogId, {
        sessionId: session.id,
        userId: user.id,
        turnNumber: session.globalTurn,
        sceneId: session.currentScene,
        mode,
        action: 'message',
        inputContent: message,
        isSubFlow: true,
        outcomeType: 'stay',
        durationMs: Date.now() - turnStart,
      }).catch(() => {})

      // Auto-confirm in auto mode: skip UI confirmation button
      const subFlow = session.flags?.subFlow as { step?: string; extracted?: Record<string, unknown> } | undefined
      if (mode === 'auto' && subFlow?.step === 'confirm' && subFlow?.extracted) {
        const confirmResult = await routeSubFlowConfirm(
          session,
          subFlow.extracted,
          user,
          request,
        )
        logTurn(sessionLogId, {
          sessionId: session.id,
          userId: user.id,
          turnNumber: session.globalTurn,
          sceneId: session.currentScene,
          mode,
          action: 'subflow_confirm',
          inputContent: JSON.stringify(subFlow.extracted),
          isSubFlow: true,
          outcomeType: 'stay',
          durationMs: Date.now() - turnStart,
        }).catch(() => {})
        return confirmResult
      }

      return subFlowResult
    }

    // ─── Behavior Engine: intercept if active behavior handles message ───
    const behaviorResult = await processBehavior(
      session,
      message,
      { id: user.id, name: user.name ?? null },
    )
    if (behaviorResult) {
      logTurn(sessionLogId, {
        sessionId: session.id,
        userId: user.id,
        turnNumber: session.globalTurn,
        sceneId: session.currentScene,
        mode,
        action: 'message',
        inputContent: message,
        outcomeType: 'stay',
        durationMs: Date.now() - turnStart,
      }).catch(() => {})

      const behaviorEnvelope = behaviorResult.message
        ? toEnvelope(behaviorResult.message, 'system', 'public')
        : undefined

      return NextResponse.json({
        success: true,
        message: behaviorEnvelope,
        currentScene: session.currentScene,
        sessionId: session.id,
        behaviorPresentation: serializePresentation(
          behaviorResult.presentation ?? buildBehaviorPresentation(session),
        ),
        data: behaviorResult.data,
      })
    }

    // ─── Normal game loop ───
    const visitorInfo = { name: user.name || undefined, type: 'pa' as const }
    const response = await processMessageWithAI(session, message, visitorInfo, originalMessage, user.accessToken)

    let fcResult: FCResult | undefined
    let sessionEnded = false

    if (response.functionCall) {
      // Handle leave_platform before other FCs
      if (response.functionCall.name === 'GM.leavePlatform') {
        response.functionCall.status = 'executed'
        fcResult = { name: 'GM.leavePlatform', status: 'executed', detail: 'PA 离开了平台' }
        sessionEnded = true
        endSession(session, 'pa_leave')
        closeSessionLog(sessionLogId, 'pa_leave').catch(() => {})
      } else {
        fcResult = await executeFunctionCall(session, response, originalMessage || message, user)
      }
    }

    if (fcResult?.status === 'executed') {
      recordAchievement(session, {
        sceneId: response._turnMeta.prevScene,
        actionId: fcResult.name,
        label: fcResult.detail || fcResult.name,
      })
    }

    // Same-scene action repeat guard (catches loops where NPC text varies)
    let actionRepeatOverride: { pa: string; agent: string } | null = null
    if (response.functionCall?.name && !response.sceneTransition) {
      actionRepeatOverride = checkActionRepeat(
        session,
        response._turnMeta.prevScene,
        response.functionCall.name,
      )
      if (actionRepeatOverride && mode === 'auto') {
        sessionEnded = true
        endSession(session, 'loop_guard')
        closeSessionLog(sessionLogId, 'loop_guard').catch(() => {})
        response.message = actionRepeatOverride
      } else if (actionRepeatOverride) {
        response.message = actionRepeatOverride
      }
    }

    const attemptedTransition = response.sceneTransition
      ? { from: response.sceneTransition.from, to: response.sceneTransition.to }
      : null

    let returnReason = computeReturnContext(session, attemptedTransition, fcResult)

    let npcGenerateMs = 0
    if (!sessionEnded) {
      const npcStart = Date.now()
      await generateNPCReplyForTurn(session, response, fcResult)
      npcGenerateMs = Date.now() - npcStart
    }

    // Refine return context if NPC assessed as scope redirect
    if (attemptedTransition?.to === 'lobby' && response._npcMeta?.scopeAssessment === 'redirect') {
      const fromScene = attemptedTransition.from
      const npcName = getOntology().scenes[fromScene]?.npc ?? '未知'
      setReturnContext(session, {
        fromScene,
        npcName,
        reason: 'scope_redirect',
        summary: `${npcName}认为这不在其职责范围内，建议回大厅`,
      })
      returnReason = 'npc_redirect'
      persistSession(session)
    }

    // Record event for journey memory (include goal if present)
    const npcText = response.message?.pa || ''
    const goal = getCurrentGoal(session)
    const goalTag = goal ? ` [目标: ${goal.purpose}]` : ''
    const eventDesc = response.sceneTransition
      ? `从「${getSceneLabel(response.sceneTransition.from)}」去「${getSceneLabel(response.sceneTransition.to)}」${goalTag}`
      : `在「${getSceneLabel(session.currentScene)}」：${npcText.slice(0, 50)}`
    recordEvent(session, eventDesc)

    if (response.sceneTransition) {
      resetSceneTurns(session)
    } else {
      incrementSceneTurns(session)
    }
    persistSession(session)

    // Reset navigator attempts when PA successfully leaves lobby
    if (attemptedTransition?.from === 'lobby' && attemptedTransition.to !== 'lobby') {
      session.flags = { ...session.flags, navigatorAttempts: 0 }
      persistSession(session)
    }

    // Check cross-scene transition loop
    let transitionLoopOverride: { pa: string; agent: string } | null = null

    if (response.sceneTransition) {
      transitionLoopOverride = recordTransitionAndCheck(
        session,
        response.sceneTransition.from,
        response.sceneTransition.to,
      )

      if (transitionLoopOverride && mode === 'auto') {
        sessionEnded = true
        endSession(session, 'loop_guard')
        closeSessionLog(sessionLogId, 'loop_guard').catch(() => {})
        response.message = transitionLoopOverride
        delete response.sceneTransition
      } else if (transitionLoopOverride) {
        response.message = transitionLoopOverride
      }

      if (!sessionEnded && response.sceneTransition) {
        const targetScene = getScene(response.sceneTransition.to)
        if (targetScene.dataLoader) {
          response.data = await loadSceneData(targetScene.dataLoader, request, user.id)
        }
      }
    }

    const { _turnMeta, _npcMeta, ...publicResponse } = response

    const convHistory = session.flags?._conversationHistory as { guardTriggered?: boolean } | undefined
    const loopDetected = convHistory?.guardTriggered === true || !!transitionLoopOverride || !!actionRepeatOverride

    let guardType: string | undefined
    if (actionRepeatOverride) guardType = 'action_repeat'
    else if (transitionLoopOverride) guardType = 'transition_loop'
    else if (convHistory?.guardTriggered) guardType = 'npc_repetition'

    const paIntent = session.flags?._lastPaIntent as string | undefined
    const paConfidence = session.flags?._lastPaConfidence as number | undefined
    if (session.flags) {
      delete session.flags._lastPaIntent
      delete session.flags._lastPaConfidence
    }

    logTurn(sessionLogId, {
      sessionId: session.id,
      userId: user.id,
      turnNumber: session.globalTurn,
      sceneId: _turnMeta.prevScene,
      mode,
      action: 'message',
      inputContent: message,
      originalMessage,
      actionMatched: response.functionCall?.name,
      matchMethod: _turnMeta.isFreeChat ? 'free_chat' : 'ai_classifier',
      classifierConfidence: _turnMeta.classifierConfidence,
      classifierSource: _turnMeta.classifierSource,
      outcomeType: _turnMeta.outcome.type,
      functionCallName: response.functionCall?.name,
      functionCallStatus: response.functionCall?.status ?? fcResult?.status,
      npcReply: response.message?.pa,
      transitionFrom: attemptedTransition?.from,
      transitionTo: attemptedTransition?.to,
      paIntent,
      paConfidence,
      paGoal: goal?.purpose,
      returnReason,
      loopDetected,
      guardType,
      durationMs: Date.now() - turnStart,
      npcGenerateMs: npcGenerateMs || undefined,
    }).catch(() => {})

    const envelope = publicResponse.message
      ? toEnvelope(
          publicResponse.message,
          (transitionLoopOverride || actionRepeatOverride) ? 'system' : (_npcMeta?.scopeAssessment === 'redirect' ? 'system' : 'npc'),
          'public',
          {
            fcName: fcResult?.name,
            fcStatus: fcResult?.status,
            scopeAssessment: _npcMeta?.scopeAssessment ?? 'in_scope',
          },
        )
      : publicResponse.message

    const summaryPayload = sessionEnded ? { summary: buildSessionSummary(session) } : {}
    return NextResponse.json({
      success: true,
      ...publicResponse,
      message: envelope,
      sessionEnded,
      ...summaryPayload,
      behaviorPresentation: serializePresentation(buildBehaviorPresentation(session)),
      timing: { npcGenerateMs, totalMs: Date.now() - turnStart },
    })
  } catch (error) {
    console.error('GM process error:', error)
    return NextResponse.json({ error: '处理失败' }, { status: 500 })
  }
}

