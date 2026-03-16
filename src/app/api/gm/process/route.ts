import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getOrCreateSession, enterSceneWithAI, processMessageWithAI } from '@/lib/gm/engine'
import { getScene } from '@/lib/gm/scenes'

/**
 * POST /api/gm/process
 * Core GM conversation endpoint for Web mode.
 * Handles: entering scenes, processing PA messages, scene transitions.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const body = await request.json()
    const { message, sessionId, action } = body as {
      message?: string
      sessionId?: string
      action?: 'enter' | 'message'
    }

    const mode = body.mode || 'manual'
    const session = getOrCreateSession(sessionId, mode)

    if (action === 'enter' || !sessionId) {
      const sceneId = body.sceneId || 'lobby'
      const scene = getScene(sceneId)
      let sceneData: Record<string, unknown> | undefined

      if (scene.dataLoader) {
        sceneData = await loadSceneData(scene.dataLoader, request, user.id)
      }

      const visitorInfo = { name: user.name || undefined, type: 'pa' as const }
      const response = await enterSceneWithAI(session, sceneId, sceneData, visitorInfo)
      return NextResponse.json({ success: true, ...response })
    }

    if (!message) {
      return NextResponse.json({ error: '缺少 message' }, { status: 400 })
    }

    const visitorInfo = { name: user.name || undefined, type: 'pa' as const }
    const response = await processMessageWithAI(session, message, visitorInfo)

    if (response.sceneTransition) {
      const targetScene = getScene(response.sceneTransition.to)
      if (targetScene.dataLoader) {
        response.data = await loadSceneData(targetScene.dataLoader, request, user.id)
      }
    }

    return NextResponse.json({ success: true, ...response })
  } catch (error) {
    console.error('GM process error:', error)
    return NextResponse.json({ error: '处理失败' }, { status: 500 })
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
