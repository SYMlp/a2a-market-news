/**
 * Lifecycle Manager — spec-driven lifecycle helpers.
 *
 * Provides cancel keyword patterns and timeout checks
 * derived from ComponentSpec lifecycle config.
 *
 * Architecture: docs/component-spec-architecture.md (P7-1)
 */

import type { ComponentSpec } from './types'

const DEFAULT_CANCEL_PATTERNS = ['取消', '算了', '不改了', '不要了', '不做了', '退出', 'cancel']

/**
 * Get cancel keyword patterns from spec.
 * Used by router to detect user intent to cancel SubFlow.
 */
export function getCancelPatterns(spec: ComponentSpec): string[] {
  return spec.lifecycle?.onKeyword?.patterns ?? DEFAULT_CANCEL_PATTERNS
}

/**
 * Get confirm phase timeout in ms.
 * Returns undefined if no timeout configured.
 */
export function getConfirmTimeoutMs(spec: ComponentSpec): number | undefined {
  return spec.lifecycle?.delays?.confirmTimeout
}

/**
 * Check if SubFlow has exceeded its confirm timeout.
 * @param spec ComponentSpec
 * @param activatedAtMs Timestamp when SubFlow was activated (Date.now())
 */
export function isConfirmTimeoutExceeded(
  spec: ComponentSpec,
  activatedAtMs: number,
): boolean {
  const timeoutMs = getConfirmTimeoutMs(spec)
  if (!timeoutMs || timeoutMs <= 0) return false
  return Date.now() - activatedAtMs >= timeoutMs
}
