import { NextRequest, NextResponse } from 'next/server'
import type { GameSession, SubFlowType } from '@/lib/engine/types'
import { persistSession } from '@/lib/engine/session'
import { registerHandler } from './register'
import { appSettingsHandler } from './app-settings'
import { appLifecycleHandler } from './app-lifecycle'
import { profileHandler } from './profile'

export interface SubFlowHandler {
  type: SubFlowType
  handleMessage(session: GameSession, message: string, user: { id: string; name: string | null }): NextResponse
  handleConfirm(
    session: GameSession,
    args: Record<string, unknown>,
    user: { id: string; name: string | null },
    request: NextRequest,
  ): Promise<NextResponse>
}

const handlers = new Map<SubFlowType, SubFlowHandler>([
  [registerHandler.type, registerHandler],
  [appSettingsHandler.type, appSettingsHandler],
  [appLifecycleHandler.type, appLifecycleHandler],
  [profileHandler.type, profileHandler],
])

export function routeSubFlow(
  session: GameSession,
  message: string,
  user: { id: string; name: string | null },
): NextResponse | null {
  const subFlow = session.flags?.subFlow
  if (!subFlow) return null

  const handler = handlers.get(subFlow.type as SubFlowType)
  if (!handler) return null

  return handler.handleMessage(session, message, user)
}

export async function routeSubFlowConfirm(
  session: GameSession,
  args: Record<string, unknown>,
  user: { id: string; name: string | null },
  request: NextRequest,
): Promise<NextResponse> {
  const subFlow = session.flags?.subFlow
  if (!subFlow) {
    return NextResponse.json({ success: false, error: '无活跃子流程' }, { status: 400 })
  }

  const handler = handlers.get(subFlow.type as SubFlowType)
  if (!handler) {
    return NextResponse.json({ success: false, error: `未知子流程类型: ${subFlow.type}` }, { status: 400 })
  }

  return handler.handleConfirm(session, args, user, request)
}

export function activateSubFlow(
  session: GameSession,
  type: SubFlowType,
  initialContext: Record<string, unknown>,
): void {
  session.flags = {
    ...session.flags,
    subFlow: {
      type,
      step: 'collect',
      messages: [],
      context: initialContext,
    },
  }
  persistSession(session)
}
