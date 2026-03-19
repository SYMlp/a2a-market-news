import { NextRequest, NextResponse } from 'next/server'
import type { GameSession, SubFlowType } from '@/lib/engine/types'
import { persistSession } from '@/lib/engine/session'
import { loadSpec } from '@/lib/component-runtime/parser'
import { createSubFlowHandler } from '@/lib/component-runtime/subflow-adapter'
import { getCancelPatterns, isConfirmTimeoutExceeded } from '@/lib/component-runtime/lifecycle-manager'

const SPEC_NAME_BY_TYPE: Record<SubFlowType, string> = {
  app_settings: 'app-settings',
  app_lifecycle: 'app-lifecycle',
  profile: 'profile',
  register: 'register',
}

export interface SubFlowHandler {
  type: SubFlowType
  handleMessage(session: GameSession, message: string, user: { id: string; name: string | null }): NextResponse | Promise<NextResponse>
  handleConfirm(
    session: GameSession,
    args: Record<string, unknown>,
    user: { id: string; name: string | null },
    request: NextRequest,
  ): Promise<NextResponse>
}

// Spec-driven handlers (P3/P4: load YAML → generate handler → register)
const appSettingsHandler = createSubFlowHandler(loadSpec('app-settings'))
const profileHandler = createSubFlowHandler(loadSpec('profile'))
const appLifecycleHandler = createSubFlowHandler(loadSpec('app-lifecycle'))
const registerSpecHandler = createSubFlowHandler(loadSpec('register'))

const handlers = new Map<SubFlowType, SubFlowHandler>([
  [registerSpecHandler.type, registerSpecHandler],
  [appSettingsHandler.type, appSettingsHandler],
  [profileHandler.type, profileHandler],
  [appLifecycleHandler.type, appLifecycleHandler],
])

export function cancelSubFlow(session: GameSession): boolean {
  if (!session.flags?.subFlow) return false
  session.flags = { ...session.flags, subFlow: undefined }
  persistSession(session)
  return true
}

export async function routeSubFlow(
  session: GameSession,
  message: string,
  user: { id: string; name: string | null },
): Promise<NextResponse | null> {
  const subFlow = session.flags?.subFlow
  if (!subFlow) return null

  const spec = loadSpec(SPEC_NAME_BY_TYPE[subFlow.type as SubFlowType])
  const cancelPatterns = getCancelPatterns(spec)
  const activatedAt = (subFlow as { activatedAt?: number }).activatedAt ?? 0

  if (cancelPatterns.some(k => message.includes(k))) {
    cancelSubFlow(session)
    return NextResponse.json({
      success: true,
      message: {
        pa: '好的，已取消。还想做什么？',
        agent: 'SubFlow cancelled by user keyword.',
      },
      currentScene: session.currentScene,
      sessionId: session.id,
    })
  }

  if (subFlow.step === 'confirm' && isConfirmTimeoutExceeded(spec, activatedAt)) {
    cancelSubFlow(session)
    return NextResponse.json({
      success: true,
      message: {
        pa: '操作超时，已自动取消。还想做什么？',
        agent: 'SubFlow cancelled by confirm timeout.',
      },
      currentScene: session.currentScene,
      sessionId: session.id,
    })
  }

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
      activatedAt: Date.now(),
    },
  }
  persistSession(session)
}

/** Spec-driven activation: load spec by name, activate with spec.id. Use for spec-driven SubFlows. */
export function activateSubFlowFromSpec(
  session: GameSession,
  specName: string,
  initialContext: Record<string, unknown>,
): void {
  const spec = loadSpec(specName)
  activateSubFlow(session, spec.id as SubFlowType, initialContext)
}
