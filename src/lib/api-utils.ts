import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { reportApiError } from '@/lib/server-observability'

type User = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>

/** Unified pagination block for list endpoints (`success` + `data` + `pagination`). */
export type ApiPagination = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export function buildPagination(page: number, limit: number, total: number): ApiPagination {
  const safeLimit = Math.max(1, limit)
  return {
    page,
    limit: safeLimit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / safeLimit),
  }
}

/**
 * Parse `page` and `limit` from query string with safe bounds.
 */
export function parsePaginationParams(
  searchParams: URLSearchParams,
  options: { defaultPage?: number; defaultLimit?: number; maxLimit?: number } = {},
): { page: number; limit: number } {
  const defaultPage = options.defaultPage ?? 1
  const defaultLimit = options.defaultLimit ?? 20
  const maxLimit = options.maxLimit ?? 100

  const pageRaw = parseInt(searchParams.get('page') ?? String(defaultPage), 10)
  const page = Math.max(1, Number.isFinite(pageRaw) ? pageRaw : defaultPage)

  const limitRaw = parseInt(searchParams.get('limit') ?? String(defaultLimit), 10)
  const limit = Math.min(
    maxLimit,
    Math.max(1, Number.isFinite(limitRaw) ? limitRaw : defaultLimit),
  )

  return { page, limit }
}

export function apiSuccess<T>(data: T) {
  return NextResponse.json({ success: true, data })
}

/** Paginated list: `{ success, data, pagination }`. */
export function apiPaginated<T>(data: T[], total: number, page: number, limit: number) {
  return NextResponse.json({
    success: true,
    data,
    pagination: buildPagination(page, limit, total),
  })
}

/** Use when the service layer already computed `ApiPagination`. */
export function apiListPage<T>(data: T[], pagination: ApiPagination) {
  return NextResponse.json({ success: true, data, pagination })
}

export function apiError(message: string, status: number = 500) {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Require an authenticated user. Returns the user or throws a 401 NextResponse.
 * Usage:
 *   const user = await requireAuth()
 *   // if we reach here, user is guaranteed non-null
 *
 * Because Next.js route handlers expect a Response to be returned (not thrown),
 * callers should use the try/catch pattern or the `withAuth` wrapper.
 */
export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) {
    throw new AuthError()
  }
  return user
}

export class AuthError extends Error {
  public readonly response: NextResponse

  constructor() {
    super('Unauthorized')
    this.name = 'AuthError'
    this.response = NextResponse.json(
      { error: '请先登录', errorCode: 'UNAUTHORIZED', errorEn: 'Please log in first' },
      { status: 401 },
    )
  }
}

export class ForbiddenError extends Error {
  public readonly response: NextResponse

  constructor(message: string = '没有权限', errorCode: string = 'FORBIDDEN') {
    super(message)
    this.name = 'ForbiddenError'
    this.response = NextResponse.json(
      { error: message, errorCode, errorEn: errorCode === 'REQUIRE_DEVELOPER' ? 'Developer account required' : 'Access denied' },
      { status: 403 },
    )
  }
}

export function requireDeveloper(user: User): asserts user is User & { isDeveloper: true } {
  if (!user.isDeveloper) {
    throw new ForbiddenError('需要开发者身份', 'REQUIRE_DEVELOPER')
  }
}

/**
 * Wraps an authenticated API handler. Handles auth check and top-level errors uniformly.
 *
 * Usage:
 *   export const POST = withAuth(async (request, user) => {
 *     const body = await request.json()
 *     return apiSuccess({ done: true })
 *   })
 */
export function withAuth(
  handler: (request: Request, user: User) => Promise<NextResponse>,
) {
  return async (request: Request) => {
    try {
      const user = await requireAuth()
      return await handler(request, user)
    } catch (error) {
      if (error instanceof AuthError) {
        return error.response
      }
      if (error instanceof ForbiddenError) {
        return error.response
      }
      reportApiError(request, error, 'withAuth_handler_failed', {
        route: `${request.method} ${new URL(request.url).pathname}`,
      })
      return apiError('Operation failed', 500)
    }
  }
}
