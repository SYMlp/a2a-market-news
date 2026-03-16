import { NextRequest, NextResponse } from 'next/server'
import { validateAgentToken } from '@/lib/agent-auth'
import {
  getOrCreateSession,
  enterScene,
  processMessage,
} from '@/lib/gm/engine'
import { getScene } from '@/lib/gm/scenes'

/**
 * POST /api/agent/gm
 * Stateful conversation endpoint for OpenClaw / external agents.
 * Returns Agent perspective (DualText.agent) + structured actions.
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
    } = body as {
      message?: string
      session_id?: string
      agent_id?: string
      agent_name?: string
      action?: 'enter' | 'message'
    }

    const session = getOrCreateSession(sessionId, 'manual', agentId, agentName)

    // Enter a scene (or start fresh)
    if (action === 'enter' || !sessionId) {
      const sceneId = body.scene || 'lobby'
      let sceneData: Record<string, unknown> | undefined

      const scene = getScene(sceneId)
      if (scene.dataLoader) {
        sceneData = await fetchSceneData(scene.dataLoader, request)
      }

      const response = await enterScene(session, sceneId, sceneData)

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

    if (!message) {
      return NextResponse.json(
        { error: 'Missing "message" field' },
        { status: 400 },
      )
    }

    const response = await processMessage(session, message)

    // Load data for new scene if transitioning
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
