import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { persistSession } from '@/lib/engine/session'
import type { GameSession, SubFlowState } from '@/lib/engine/types'
import type { SubFlowHandler } from './router'

interface AppInfo {
  id: string
  name: string
  clientId: string | null
}

function parseApps(session: GameSession): AppInfo[] {
  const raw = session.data?.apps_json
  if (typeof raw !== 'string') return []
  try {
    const arr = JSON.parse(raw) as AppInfo[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function resolveAppFromMessage(message: string, apps: AppInfo[]): AppInfo | null {
  if (apps.length === 0) return null
  const indexMatch = message.match(/第?([一二三四五1-5])[个号]?/)
  if (indexMatch) {
    const map: Record<string, number> = { '一': 0, '二': 1, '三': 2, '四': 3, '五': 4, '1': 0, '2': 1, '3': 2, '4': 3, '5': 4 }
    const idx = map[indexMatch[1]]
    if (idx !== undefined && idx < apps.length) return apps[idx]
  }
  for (const app of apps) {
    if (message.includes(app.name)) return app
  }
  return apps[0]
}

function extractChanges(message: string): Record<string, string> {
  const changes: Record<string, string> = {}
  const nameMatch = message.match(/(?:名字?|名称)(?:改成?|改为?|是|为)[\s:：]*[「"'《]?([^」"'》\n]{1,50})[」"'》]?/)
  if (nameMatch) changes.name = nameMatch[1].trim()
  const descMatch = message.match(/(?:简介|描述|说明)(?:改成?|改为?|是|为)[\s:：]*[「"'《]?([^」"'》\n]{1,200})[」"'》]?/)
  if (descMatch) changes.description = descMatch[1].trim()
  return changes
}

function handleAppSettingsMessage(
  session: GameSession,
  message: string,
  _user: { id: string; name: string | null },
): NextResponse {
  const subFlow = session.flags!.subFlow as SubFlowState
  const messages = subFlow.messages ?? []
  messages.push(message)
  subFlow.messages = messages
  const context = (subFlow.context ?? {}) as Record<string, unknown>
  const apps = parseApps(session)

  if (apps.length === 0) {
    persistSession(session)
    return NextResponse.json({
      success: true,
      message: {
        pa: '你还没有注册任何应用，无法编辑。先注册一个吧！',
        agent: 'No apps to edit.',
      },
      currentScene: session.currentScene,
      sessionId: session.id,
    })
  }

  let appId = context.appId as string | undefined
  let changes = (context.changes as Record<string, string>) ?? {}

  if (!appId) {
    const selected = resolveAppFromMessage(message, apps)
    if (selected) {
      appId = selected.id
      context.appId = appId
      context.appName = selected.name
    }
  }

  if (appId && Object.keys(changes).length === 0) {
    const extracted = extractChanges(message)
    if (Object.keys(extracted).length > 0) {
      changes = extracted
      context.changes = changes
    }
  }

  subFlow.context = context

  if (appId && Object.keys(changes).length > 0) {
    subFlow.step = 'confirm'
    subFlow.extracted = { appId, changes }
    persistSession(session)

    return NextResponse.json({
      success: true,
      message: {
        pa: '收到！确认一下修改内容——',
        agent: `App settings update. appId: ${appId}, changes: ${JSON.stringify(changes)}.`,
      },
      currentScene: session.currentScene,
      sessionId: session.id,
      functionCall: {
        name: 'GM.updateAppSettings',
        args: { appId, changes },
        status: 'pending',
      },
    })
  }

  persistSession(session)
  const followUp = !appId
    ? '想编辑哪个应用？可以说「第一个」或应用名称。'
    : '想修改哪些信息？可以说「名字改成XXX」或「简介改成XXX」。'
  return NextResponse.json({
    success: true,
    message: {
      pa: followUp,
      agent: appId ? 'Need changes.' : 'Need app selection.',
    },
    currentScene: session.currentScene,
    sessionId: session.id,
  })
}

async function handleAppSettingsConfirm(
  session: GameSession,
  args: Record<string, unknown>,
  user: { id: string; name: string | null },
  _request: NextRequest,
): Promise<NextResponse> {
  try {
    const appId = String(args?.appId ?? '')
    const changes = args?.changes as Record<string, string> | undefined

    if (!appId || !changes || Object.keys(changes).length === 0) {
      return NextResponse.json({
        success: false,
        error: '缺少 appId 或 changes',
      }, { status: 400 })
    }

    const app = await prisma.app.findUnique({ where: { id: appId } })
    if (!app) {
      return NextResponse.json({ success: false, error: '应用不存在' }, { status: 404 })
    }
    if (app.developerId !== user.id) {
      return NextResponse.json({ success: false, error: '无权修改此应用' }, { status: 403 })
    }

    const updateData: Record<string, unknown> = {}
    if (changes.name !== undefined) updateData.name = changes.name
    if (changes.description !== undefined) updateData.description = changes.description
    if (changes.website !== undefined) updateData.website = changes.website

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: '没有可更新的字段' }, { status: 400 })
    }

    await prisma.app.update({
      where: { id: appId },
      data: updateData,
    })

    if (session.flags?.subFlow) {
      session.flags = { ...session.flags, subFlow: undefined }
      persistSession(session)
    }

    return NextResponse.json({
      success: true,
      message: {
        pa: `已更新「${app.name}」的设置！`,
        agent: `App ${appId} updated.`,
      },
      currentScene: session.currentScene,
      sessionId: session.id,
    })
  } catch (error) {
    console.error('App settings confirm failed:', error)
    return NextResponse.json({ success: false, error: '更新失败，请重试' }, { status: 500 })
  }
}

export const appSettingsHandler: SubFlowHandler = {
  type: 'app_settings',
  handleMessage: handleAppSettingsMessage,
  handleConfirm: handleAppSettingsConfirm,
}
