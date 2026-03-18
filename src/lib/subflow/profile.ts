import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { persistSession } from '@/lib/engine/session'
import type { GameSession, SubFlowState } from '@/lib/engine/types'
import type { SubFlowHandler } from './router'

const VALID_NOTIFY_PREFS = ['none', 'callback', 'in_app', 'both'] as const

function extractProfileChanges(message: string): Record<string, string> {
  const changes: Record<string, string> = {}
  const nameMatch = message.match(/(?:开发者)?(?:名字?|名称)(?:改成?|改为?|是|为)[\s:：]*[「"'《]?([^」"'》\n]{1,50})[」"'》]?/)
  if (nameMatch) changes.developerName = nameMatch[1].trim()
  const urlMatch = message.match(/(?:回调|webhook|通知)(?:地址|url|链接)?(?:改成?|改为?|是|为)[\s:：]*([^\s，,。\n]{10,200})/)
  if (urlMatch) changes.callbackUrl = urlMatch[1].trim()
  const prefMatch = message.match(/(?:通知)(?:偏好|方式)?(?:改成?|改为?|是|为)[\s:：]*(仅站内|站内|in_app|仅回调|回调|callback|两者|both|不通知|none)/i)
  if (prefMatch) {
    const map: Record<string, string> = {
      '仅站内': 'in_app', '站内': 'in_app', 'in_app': 'in_app',
      '仅回调': 'callback', '回调': 'callback', 'callback': 'callback',
      '两者': 'both', 'both': 'both',
      '不通知': 'none', 'none': 'none',
    }
    const v = map[prefMatch[1].toLowerCase()] ?? map[prefMatch[1]]
    if (v) changes.notifyPreference = v
  }
  return changes
}

function handleProfileMessage(
  session: GameSession,
  message: string,
  _user: { id: string; name: string | null },
): NextResponse {
  const subFlow = session.flags!.subFlow as SubFlowState
  const messages = subFlow.messages ?? []
  messages.push(message)
  subFlow.messages = messages
  const context = (subFlow.context ?? {}) as Record<string, unknown>
  let changes = (context.changes as Record<string, string>) ?? {}

  const extracted = extractProfileChanges(message)
  if (Object.keys(extracted).length > 0) {
    changes = { ...changes, ...extracted }
    context.changes = changes
  }

  subFlow.context = context

  if (Object.keys(changes).length > 0) {
    subFlow.step = 'confirm'
    subFlow.extracted = { changes }
    persistSession(session)

    return NextResponse.json({
      success: true,
      message: {
        pa: '收到！确认一下修改内容——',
        agent: `Profile update. changes: ${JSON.stringify(changes)}.`,
      },
      currentScene: session.currentScene,
      sessionId: session.id,
      functionCall: {
        name: 'GM.updateProfile',
        args: { changes },
        status: 'pending',
      },
    })
  }

  persistSession(session)
  return NextResponse.json({
    success: true,
    message: {
      pa: '想修改哪些信息？可以说「名字改成XXX」或「回调地址改成XXX」或「通知改成仅站内」。',
      agent: 'Need profile changes: developerName, callbackUrl, notifyPreference.',
    },
    currentScene: session.currentScene,
    sessionId: session.id,
  })
}

async function handleProfileConfirm(
  session: GameSession,
  args: Record<string, unknown>,
  user: { id: string; name: string | null },
  _request: NextRequest,
): Promise<NextResponse> {
  try {
    const changes = args?.changes as Record<string, string> | undefined

    if (!changes || Object.keys(changes).length === 0) {
      return NextResponse.json({
        success: false,
        error: '缺少 changes',
      }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    if (changes.developerName !== undefined) {
      data.developerName = changes.developerName.trim() || null
    }
    if (changes.callbackUrl !== undefined) {
      data.callbackUrl = changes.callbackUrl.trim() || null
    }
    if (changes.notifyPreference !== undefined) {
      if (VALID_NOTIFY_PREFS.includes(changes.notifyPreference as typeof VALID_NOTIFY_PREFS[number])) {
        data.notifyPreference = changes.notifyPreference
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({
        success: false,
        error: '没有可更新的字段',
      }, { status: 400 })
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data,
    })

    if (session.flags?.subFlow) {
      session.flags = { ...session.flags, subFlow: undefined }
      persistSession(session)
    }

    return NextResponse.json({
      success: true,
      message: {
        pa: '开发者资料已更新！',
        agent: `Profile updated.`,
      },
      currentScene: session.currentScene,
      sessionId: session.id,
      updatedProfile: {
        developerName: updated.developerName,
        callbackUrl: updated.callbackUrl,
        notifyPreference: updated.notifyPreference,
      },
    })
  } catch (error) {
    console.error('Profile confirm failed:', error)
    return NextResponse.json({ success: false, error: '更新失败，请重试' }, { status: 500 })
  }
}

export const profileHandler: SubFlowHandler = {
  type: 'profile',
  handleMessage: handleProfileMessage,
  handleConfirm: handleProfileConfirm,
}
