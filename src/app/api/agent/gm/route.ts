import { NextRequest, NextResponse } from 'next/server'
import { validateAgentToken } from '@/lib/agent-auth'
import {
  getOrCreateSession,
  enterSceneWithAI,
  processMessageWithAI,
  processTurn,
} from '@/lib/gm/engine'
import { getScene } from '@/lib/gm/scenes'
import type { PlayerTurn } from '@/lib/gm/types'

/**
 * POST /api/agent/gm
 * Stateful conversation endpoint for OpenClaw / external agents.
 * Supports both v1 (message) and v2 (turn) formats.
 */
export async function POST(request: NextRequest) {
  const authError = validateAgentToken(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const {
      message,
      session_id: sessionId,
      agent_id: agentId,
      agent_name: agentName,
      action,
      turn,
    } = body as {
      message?: string
      session_id?: string
      agent_id?: string
      agent_name?: string
      action?: 'enter' | 'message'
      turn?: PlayerTurn
    }

    const session = getOrCreateSession(sessionId, 'manual', agentId, agentName)

    // ── V2 path: explicit turn ──
    if (turn) {
      const result = processTurn(session, turn)

      if (result.outcome?.transition) {
        const targetScene = getScene(result.outcome.transition.to)
        if (targetScene.dataLoader) {
          result.data = await fetchSceneData(targetScene.dataLoader, request)
          session.data = result.data
        }
      }

      if (turn.type === 'rest') {
        const scene = getScene(session.currentScene)
        if (scene.dataLoader) {
          result.data = await fetchSceneData(scene.dataLoader, request)
          session.data = result.data
        }
      }

      return NextResponse.json({
        gm_message: result.message.agent,
        current_space: result.scene.id,
        session_id: result.sessionId,
        data: result.data,
        actions: result.actions,
        meta: result.meta,
        outcome: result.outcome,
        delay: result.delay,
      })
    }

    // ── V1 path: enter scene ──
    if (action === 'enter' || !sessionId) {
      const sceneId = body.scene || 'lobby'
      let sceneData: Record<string, unknown> | undefined

      const scene = getScene(sceneId)
      if (scene.dataLoader) {
        sceneData = await fetchSceneData(scene.dataLoader, request)
      }

      const visitorInfo = { name: agentName, type: 'agent' as const }
      const response = await enterSceneWithAI(session, sceneId, sceneData, visitorInfo)

      return NextResponse.json({
        gm_message: response.message.agent,
        current_space: response.currentScene,
        session_id: response.sessionId,
        data: response.data,
        available_actions: response.availableActions,
        function_call: response.functionCall || null,
        scene_transition: response.sceneTransition || null,
      })
    }

    // ── V1 path: process message ──
    if (!message) {
      return NextResponse.json(
        { error: 'Missing "message" or "turn" field' },
        { status: 400 },
      )
    }

    const visitorInfo = { name: agentName, type: 'agent' as const }
    const response = await processMessageWithAI(session, message, visitorInfo)

    if (response.sceneTransition) {
      const targetScene = getScene(response.sceneTransition.to)
      if (targetScene.dataLoader) {
        response.data = await fetchSceneData(targetScene.dataLoader, request)
      }
    }

    return NextResponse.json({
      gm_message: response.message.agent,
      current_space: response.currentScene,
      session_id: response.sessionId,
      data: response.data,
      available_actions: response.availableActions,
      function_call: response.functionCall || null,
      scene_transition: response.sceneTransition || null,
    })
  } catch (error) {
    console.error('Agent GM error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function fetchSceneData(
  loader: string,
  request: NextRequest,
): Promise<Record<string, unknown>> {
  try {
    const origin = new URL(request.url).origin
    const res = await fetch(`${origin}${loader}`, {
      headers: {
        authorization: request.headers.get('authorization') || '',
        cookie: request.headers.get('cookie') || '',
      },
    })
    if (!res.ok) return {}
    const data = await res.json()
    return data.data || data
  } catch {
    return {}
  }
}
