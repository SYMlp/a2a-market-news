/**
 * FC Dispatcher — ontology-driven function call execution.
 *
 * Reads `execution` metadata from operational-ontology.json and dispatches
 * each FC by type: builtin (auto-handled), subflow (spec activation),
 * handler (registered effect), behavior (BehaviorSpec activation).
 *
 * Replaces the switch/case in function-call-executor.ts.
 * Architecture: docs/gm-orchestration-architecture.md §7
 */

import { prisma } from '@/lib/prisma'
import { getOperationalOntology } from './ontology'
import { activateSubFlowFromSpec } from '@/lib/subflow/router'
import { invokeEffect, type EffectContext } from '@/lib/component-runtime/handler-registry'
import { activateBehavior, getBehaviorByTrigger } from '@/lib/behavior-engine'
import { checkPrecondition } from './session-context'
import type { GameSession, GMResponse, FCResult } from './types'

export interface FCUserContext {
  id: string
  secondmeUserId: string
  name: string | null
}

/**
 * Dispatch a function call using ontology execution metadata.
 * Falls back to `{ status: 'skipped' }` if no execution config is found.
 */
export async function dispatchFC(
  session: GameSession,
  response: GMResponse,
  fcName: string,
  message: string,
  user: FCUserContext,
): Promise<FCResult> {
  const ontology = getOperationalOntology()
  const entry = ontology.functionCalls[fcName]

  if (!entry?.execution) {
    return { name: fcName, status: 'skipped', detail: 'No execution config in ontology' }
  }

  const exec = entry.execution

  let result: FCResult

  switch (exec.type) {
    case 'builtin':
      result = handleBuiltin(fcName, exec.handler)
      break

    case 'subflow':
      result = await handleSubflow(session, fcName, exec.specName!, exec.detail!, user)
      break

    case 'handler':
      result = await handleRegisteredHandler(session, response, fcName, exec.handlerKey!, message, user)
      break

    case 'behavior': {
      const specId = exec.specName
      if (specId) {
        activateBehavior(session, specId)
        result = { name: fcName, status: 'executed', detail: exec.detail || `BehaviorSpec ${specId} activated` }
      } else {
        result = { name: fcName, status: 'skipped', detail: 'No specName in behavior execution config' }
      }
      break
    }

    default:
      result = { name: fcName, status: 'skipped' }
  }

  // Post-dispatch: activate BehaviorSpec triggered by this FC name
  if (result.status === 'executed' && exec.type !== 'behavior') {
    const triggered = getBehaviorByTrigger(fcName)
    if (
      triggered
      && !session.flags?.activeBehavior
      && triggered.availability.scenes.includes(session.currentScene)
    ) {
      const preconsMet = !triggered.availability.preconditions
        || triggered.availability.preconditions.every(p => checkPrecondition(p, session))
      if (preconsMet) {
        activateBehavior(session, triggered.id)
      }
    }
  }

  return result
}

// ─── Builtin handlers (navigation / passthrough) ─────

function handleBuiltin(
  fcName: string,
  handler: string | undefined,
): FCResult {
  if (handler === 'passthrough') {
    return { name: fcName, status: 'executed', detail: 'dataLoader 已加载' }
  }
  // navigation and other builtins
  return { name: fcName, status: 'executed' }
}

// ─── SubFlow activation with per-FC context building ─

async function handleSubflow(
  session: GameSession,
  fcName: string,
  specName: string,
  detail: string,
  user: FCUserContext,
): Promise<FCResult> {
  let context: Record<string, unknown>

  if (fcName === 'GM.startRegistration') {
    const existingApps = await prisma.app.findMany({
      where: { developerId: user.id },
      select: { id: true, name: true, clientId: true, status: true },
    })
    if (existingApps.length > 0 && existingApps.some(a => a.clientId)) {
      const registered = existingApps.filter(a => a.clientId)
      const appList = registered.map(a => `「${a.name}」`).join('、')
      return {
        name: fcName,
        status: 'executed',
        detail: `你已经注册了 ${appList}。如果想注册新的应用，请继续说明新应用的信息。`,
      }
    }
    context = {
      developerId: user.id,
      existingApps: existingApps.map(a => ({ name: a.name, clientId: a.clientId })),
    }
  } else if (fcName === 'GM.startAppSettings') {
    const userApps = await prisma.app.findMany({
      where: { developerId: user.id },
      select: { id: true, name: true, description: true, website: true, clientId: true },
    })
    context = { userApps }
  } else {
    context = {}
  }

  activateSubFlowFromSpec(session, specName, context)
  return { name: fcName, status: 'executed', detail }
}

// ─── Registered effect handler dispatch ──────────────

interface FCHandlerResult {
  name: string
  status: 'executed' | 'skipped' | 'failed'
  detail?: string
  selected?: { name: string; clientId: string; website?: string }
}

async function handleRegisteredHandler(
  session: GameSession,
  response: GMResponse,
  fcName: string,
  handlerKey: string,
  message: string,
  user: FCUserContext,
): Promise<FCResult> {
  const effectCtx: EffectContext = { session, user }
  const args: Record<string, unknown> = {
    message,
    secondmeUserId: user.secondmeUserId,
    userName: user.name,
  }

  const raw = (await invokeEffect(handlerKey, args, effectCtx)) as FCHandlerResult

  // Apply response template replacements for assignMission's selected app
  if (raw.selected && response.message) {
    response.message = {
      pa: response.message.pa
        .replace('{appName}', raw.selected.name || '')
        .replace('{appUrl}', raw.selected.website || ''),
      agent: response.message.agent
        .replace('{clientId}', raw.selected.clientId || ''),
    }
  }

  return {
    name: raw.name ?? fcName,
    status: raw.status,
    detail: raw.detail,
  }
}
