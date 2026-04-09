import pino from 'pino'
import { getOrCreateRequestId } from './request-id'

const isTest = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test'

function createRootLogger(): pino.Logger {
  if (isTest) {
    return pino({ level: 'silent' })
  }

  const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')

  if (process.env.NODE_ENV === 'development') {
    return pino({
      level,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard' },
      },
    })
  }

  return pino({ level })
}

/** Process-wide logger (no request correlation). */
export const rootLogger = createRootLogger()

/** Structured logger with `requestId` bound from the incoming request. */
export function getLoggerForRequest(request: Request): pino.Logger {
  const requestId = getOrCreateRequestId(request.headers)
  return rootLogger.child({ requestId })
}
