import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { persistSession } from '@/lib/engine/session'
import type { GameSession, SubFlowState } from '@/lib/engine/types'
import type { SubFlowHandler } from './router'

interface AppInfo {
  id: string
  name: string
  clientId: string | null
  status?: string
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

function extractStatusIntent(message: string): 'inactive' | 'archived' | null {
  if (/暂停|停用|下线|关闭/u.test(message)) return 'inactive'
  if (/归档|存档|下架/u.test(message)) return 'archived'
  return null
}

function handleAppLifecycleMessage(
  session: GameSession,
  message: string,
  _user: { id: string; name: string | null },
): NextResponse {
  const subFlow = session.flags!.subFlow as SubFlowState
  const messages = subFlow.messages ?? []
  messages.push(message)
  subFlow.messages = messages
  const context = (subFlow.context ?? {}) as Record<string, unknown>
  const apps = parseApps(session).filter(a => a.status !== 'archived')

  if (apps.length === 0) {
    persistSession(session)
    return NextResponse.json({
      success: true,
      message: {
        pa: '你还没有可操作的应用，或所有应用都已归档。',
        agent: 'No apps to change status.',
      },
      currentScene: session.currentScene,
      sessionId: session.id,
    })
  }

  const appId = context.appId as string | undefined
  const newStatus = context.newStatus as string | undefined

  if (!appId) {
    const selected = resolveAppFromMessage(message, apps)
    if (selected) {
      context.appId = selected.id
      context.appName = selected.name
    }
  }

  if (!newStatus) {
    const intent = extractStatusIntent(message)
    if (intent) context.newStatus = intent
  }

  subFlow.context = context

  if (context.appId && context.newStatus) {
    subFlow.step = 'confirm'
    subFlow.extracted = { appId: context.appId, newStatus: context.newStatus }
    persistSession(session)

    const statusLabel = context.newStatus === 'archived' ? '归档' : '暂停'
    return NextResponse.json({
      success: true,
      message: {
        pa: `收到！确认将「${context.appName}」${statusLabel}？`,
        agent: `App lifecycle change. appId: ${context.appId}, newStatus: ${context.newStatus}.`,
      },
      currentScene: session.currentScene,
      sessionId: session.id,
      functionCall: {
        name: 'GM.changeAppStatus',
        args: { appId: context.appId, newStatus: context.newStatus },
        status: 'pending',
      },
    })
  }

  persistSession(session)
  const followUp = !context.appId
    ? '想操作哪个应用？可以说「第一个」或应用名称。'
    : '想暂停还是归档？可以说「暂停」或「归档」。'
  return NextResponse.json({
    success: true,
    message: {
      pa: followUp,
      agent: context.appId ? 'Need status intent.' : 'Need app selection.',
    },
    currentScene: session.currentScene,
    sessionId: session.id,
  })
}

async function handleAppLifecycleConfirm(
  session: GameSession,
  args: Record<string, unknown>,
  user: { id: string; name: string | null },
  _request: NextRequest,
): Promise<NextResponse> {
  try {
    const appId = String(args?.appId ?? '')
    const newStatus = String(args?.newStatus ?? '')

    if (!appId || !newStatus) {
      return NextResponse.json({
        success: false,
        error: '缺少 appId 或 newStatus',
      }, { status: 400 })
    }

    const validStatuses = ['active', 'inactive', 'archived']
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json({
        success: false,
        error: `无效状态: ${newStatus}`,
      }, { status: 400 })
    }

    const app = await prisma.app.findUnique({ where: { id: appId } })
    if (!app) {
      return NextResponse.json({ success: false, error: '应用不存在' }, { status: 404 })
    }
    if (app.developerId !== user.id) {
      return NextResponse.json({ success: false, error: '无权操作此应用' }, { status: 403 })
    }
    if (app.status === 'archived') {
      return NextResponse.json({ success: false, error: '已归档的应用无法修改状态' }, { status: 400 })
    }
    if (newStatus === 'archived' && app.status === 'archived') {
      return NextResponse.json({ success: false, error: '应用已归档' }, { status: 400 })
    }

    await prisma.app.update({
      where: { id: appId },
      data: { status: newStatus },
    })

    if (session.flags?.subFlow) {
      session.flags = { ...session.flags, subFlow: undefined }
      persistSession(session)
    }

    const statusLabel = newStatus === 'archived' ? '已归档' : newStatus === 'inactive' ? '已暂停' : '已恢复'
    return NextResponse.json({
      success: true,
      message: {
        pa: `「${app.name}」${statusLabel}！`,
        agent: `App ${appId} status updated to ${newStatus}.`,
      },
      currentScene: session.currentScene,
      sessionId: session.id,
    })
  } catch (error) {
    console.error('App lifecycle confirm failed:', error)
    return NextResponse.json({ success: false, error: '操作失败，请重试' }, { status: 500 })
  }
}

export const appLifecycleHandler: SubFlowHandler = {
  type: 'app_lifecycle',
  handleMessage: handleAppLifecycleMessage,
  handleConfirm: handleAppLifecycleConfirm,
}
