import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractAppInfo } from '@/lib/registration/extract'
import { persistSession } from '@/lib/engine/session'
import type { GameSession, SubFlowState } from '@/lib/engine/types'
import type { SubFlowHandler } from './router'

function handleRegistrationMessage(
  session: GameSession,
  message: string,
  _user: { id: string; name: string | null },
): NextResponse {
  const subFlow = session.flags!.subFlow as SubFlowState
  const messages = subFlow.messages ?? []
  messages.push(message)
  subFlow.messages = messages

  const result = extractAppInfo(messages)

  if (result.complete) {
    subFlow.extracted = result.extracted
    subFlow.step = 'confirm'
    persistSession(session)

    return NextResponse.json({
      success: true,
      message: {
        pa: '收到！让我整理一下你的应用信息——',
        agent: `Extracted: ${JSON.stringify(result.extracted)}. Awaiting confirmation.`,
      },
      currentScene: session.currentScene,
      sessionId: session.id,
      functionCall: {
        name: 'GM.registerApp',
        args: result.extracted,
        status: 'pending',
      },
    })
  }

  persistSession(session)
  return NextResponse.json({
    success: true,
    message: {
      pa: result.followUp || '能告诉我你的应用叫什么名字吗？',
      agent: `Registration incomplete. Need: ${!result.extracted.name ? 'name' : 'more info'}.`,
    },
    currentScene: session.currentScene,
    sessionId: session.id,
  })
}

async function handleRegisterConfirm(
  session: GameSession,
  args: Record<string, unknown>,
  user: { id: string; name: string | null },
  _request: NextRequest,
): Promise<NextResponse> {
  try {
    const name = String(args?.name ?? '')
    const description = String(args?.description ?? '')
    const circleType = String(args?.circleType ?? '')

    if (!name || !description || !circleType) {
      return NextResponse.json({
        success: false,
        error: '缺少必填字段: name, description, circleType',
      }, { status: 400 })
    }

    const circle = await prisma.circle.findUnique({
      where: { type: circleType },
    })
    if (!circle) {
      return NextResponse.json({
        success: false,
        error: `圈子不存在: ${circleType}`,
      }, { status: 404 })
    }

    const clientId = `app-${crypto.randomUUID().slice(0, 8)}`
    const existingClient = await prisma.app.findUnique({ where: { clientId } })
    if (existingClient) {
      return NextResponse.json({
        success: false,
        error: 'Client ID 冲突，请重试',
      }, { status: 409 })
    }

    // Registration requires explicit developer status (no auto-promote)
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
    if (!dbUser?.isDeveloper) {
      return NextResponse.json({
        success: false,
        error: '请先前往开发者注册页面完成注册',
      }, { status: 403 })
    }

    const app = await prisma.app.create({
      data: {
        name,
        description,
        circleId: circle.id,
        category: circleType,
        developerId: user.id,
        clientId,
        status: 'active',
      },
      include: { circle: true },
    })

    await prisma.appMetrics.create({
      data: { appId: app.id, date: new Date() },
    })

    // Clear sub-flow
    if (session.flags?.subFlow) {
      session.flags = { ...session.flags, subFlow: undefined }
      persistSession(session)
    }

    return NextResponse.json({
      success: true,
      message: {
        pa: `注册成功！「${name}」已正式录入 A2A 智选日报系统。\n\n欢迎来到 Agent Network！还想做什么？`,
        agent: `App "${name}" registered. clientId: ${clientId}. circleType: ${circleType}.`,
      },
      currentScene: session.currentScene,
      sessionId: session.id,
      registeredApp: {
        id: app.id,
        name: app.name,
        clientId: app.clientId,
        circleType,
      },
    })
  } catch (error) {
    console.error('Register confirm failed:', error)
    return NextResponse.json({
      success: false,
      error: '注册失败，请重试',
    }, { status: 500 })
  }
}

export const registerHandler: SubFlowHandler = {
  type: 'register',
  handleMessage: handleRegistrationMessage,
  handleConfirm: handleRegisterConfirm,
}
