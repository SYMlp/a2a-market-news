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
      result = handleBuiltin(fcName, exec.handler, exec.detail)
      break

    case 'subflow':
      result = await handleSubflow(session, fcName, exec.specName!, exec.detail!, user, exec.contextBuilder)
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
  detail: string | undefined,
): FCResult {
  if (handler === 'passthrough') {
    return { name: fcName, status: 'executed', detail: detail ?? 'executed' }
  }
  return { name: fcName, status: 'executed' }
}

// ─── SubFlow activation with per-FC context building ─

async function handleSubflow(
  session: GameSession,
  fcName: string,
  specName: string,
  detail: string,
  user: FCUserContext,
  contextBuilderKey?: string,
): Promise<FCResult> {
  let context: Record<string, unknown> = {}

  if (contextBuilderKey) {
    const effectCtx: EffectContext = { session, user }
    const result = (await invokeEffect(contextBuilderKey, {}, effectCtx)) as {
      earlyReturn?: boolean
      detail?: string
      context?: Record<string, unknown>
    }

    if (result.earlyReturn) {
      return { name: fcName, status: 'executed', detail: result.detail }
    }
    context = result.context ?? {}
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
