/**
 * SubFlow session persistence bridge.
 *
 * Component-runtime must not import `persistSession` from `engine/session` directly.
 * All session mutations go through `persistSessionState` in session-context (same as game-loop / guards).
 *
 * Architecture: docs/pa-lifecycle-architecture.md §9.9
 */

import { persistSessionState } from '@/lib/engine/session-context'
import type { GameSession } from '@/lib/engine/types'

/** Persist mutated SubFlow session state to the in-memory session store. */
export function persistSubFlowSession(session: GameSession): void {
  persistSessionState(session)
}
