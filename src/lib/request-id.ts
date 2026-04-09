/** HTTP header used for correlation across logs, responses, and Sentry. */
export const REQUEST_ID_HEADER = 'x-request-id'

/**
 * Returns existing `x-request-id` from headers, or generates a new UUID.
 * Safe for Edge (middleware) and Node (route handlers).
 */
export function getOrCreateRequestId(headers: Headers): string {
  const existing = headers.get(REQUEST_ID_HEADER)
  if (existing && existing.trim().length > 0) {
    return existing.trim()
  }
  return crypto.randomUUID()
}
