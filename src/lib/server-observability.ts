/**
 * Server-only helpers: structured logging + Sentry for API / route failures.
 * Do not import from client components.
 */
import * as Sentry from '@sentry/nextjs'
import { getLoggerForRequest } from './logger'
import { getOrCreateRequestId } from './request-id'

export function reportApiError(
  request: Request,
  error: unknown,
  message: string = 'api_error',
  extra?: Record<string, unknown>,
) {
  const requestId = getOrCreateRequestId(request.headers)
  const log = getLoggerForRequest(request)
  log.error({ err: error, ...extra }, message)

  if (!process.env.SENTRY_DSN) {
    return
  }

  Sentry.captureException(error, {
    tags: { requestId },
    extra: {
      path: new URL(request.url).pathname,
      method: request.method,
      ...extra,
    },
  })
}
