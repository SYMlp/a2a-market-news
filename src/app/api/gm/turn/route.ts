import { NextRequest, NextResponse } from 'next/server'
import { apiError, AuthError, requireAuth } from '@/lib/api-utils'
import {
  getOrCreateSession,
  processTurn,
  presentScene,
} from '@/lib/gm/engine'
import { getScene } from '@/lib/scenes'
import type { PlayerTurn } from '@/lib/gm/types'
import { reportApiError } from '@/lib/server-observability'
import { getLoggerForRequest } from '@/lib/logger'

/**
 * POST /api/gm/turn
 * V2 Game Loop endpoint — accepts explicit PlayerTurn (rest | act).
 * Returns TurnResponse with structured actions + outcome.
 */
export async function POST(request: NextRequest) {
  const log = getLoggerForRequest(request)
  try {
    log.debug({ route: 'api/gm/turn' }, 'handler_enter')
    const user = await requireAuth()

    const body = await request.json()
    const { sessionId, turn, mode } = body as {
      sessionId?: string
      turn?: PlayerTurn
      mode?: 'manual' | 'auto'
    }

    const session = getOrCreateSession(sessionId, mode || 'manual')

    if (!turn) {
      const scene = getScene(body.sceneId || session.currentScene)
      let sceneData: Record<string, unknown> | undefined
      if (scene.dataLoader) {
        sceneData = await loadSceneData(scene.dataLoader, request, user.id)
      }

      session.currentScene = scene.id
      session.round = 0
      session.data = sceneData
      session.lastActiveAt = Date.now()

      const presentation = presentScene(session)
      return NextResponse.json({
        success: true,
        sessionId: session.id,
        scene: { id: scene.id, label: { pa: scene.theme.label, agent: scene.theme.label } },
        message: presentation.opening,
        actions: presentation.actions,
        meta: presentation.meta,
        data: presentation.data,
      })
    }

    const result = processTurn(session, turn)

    if (result.outcome?.transition) {
      const targetScene = getScene(result.outcome.transition.to)
      if (targetScene.dataLoader) {
        const freshData = await loadSceneData(targetScene.dataLoader, request, user.id)
        result.data = freshData
        session.data = freshData
      }
    }

    if (turn.type === 'rest') {
      const scene = getScene(session.currentScene)
      if (scene.dataLoader) {
        const freshData = await loadSceneData(scene.dataLoader, request, user.id)
        result.data = freshData
        session.data = freshData
      }
    }

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    if (error instanceof AuthError) {
      return error.response
    }
    reportApiError(request, error, 'gm_turn_error')
    return apiError('处理失败', 500)
  }
}

async function loadSceneData(
  loader: string,
  request: NextRequest,
  userId: string,
): Promise<Record<string, unknown>> {
  try {
    const origin = new URL(request.url).origin
    const url = new URL(loader, origin)
    url.searchParams.set('userId', userId)
    const res = await fetch(url.toString(), {
      headers: { cookie: request.headers.get('cookie') || '' },
    })
    if (!res.ok) return {}
    const data = await res.json()
    return data.data || data
  } catch {
    return {}
  }
}
