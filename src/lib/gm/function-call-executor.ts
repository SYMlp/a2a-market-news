/**
 * Function Call Executor — thin wrapper around fc-dispatcher.
 *
 * All execution logic (builtin, subflow, handler, behavior) is now driven
 * by the `execution` metadata in operational-ontology.json and dispatched
 * via fc-dispatcher.ts. This module preserves the public API consumed by
 * process/route.ts.
 *
 * Architecture: docs/gm-orchestration-architecture.md §7
 */

import { rootLogger } from '@/lib/logger'
import { dispatchFC, type FCUserContext } from '@/lib/engine/fc-dispatcher'
import type { GameSession, GMResponse, FCResult } from '@/lib/engine/types'

export type UserContext = FCUserContext

export async function executeFunctionCall(
  session: GameSession,
  response: GMResponse,
  message: string,
  user: UserContext,
): Promise<FCResult> {
  const fc = response.functionCall
  if (!fc) return { name: 'unknown', status: 'skipped' }

  try {
    const result = await dispatchFC(session, response, fc.name, message, user)
    if (result.status === 'executed') {
      fc.status = 'executed'
    }
    return result
  } catch (err) {
    rootLogger.error({ err, functionName: fc.name }, 'function_call_failed')
    return { name: fc.name, status: 'failed', detail: String(err) }
  }
}
