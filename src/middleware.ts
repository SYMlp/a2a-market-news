import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getOrCreateRequestId, REQUEST_ID_HEADER } from '@/lib/request-id'

const LOCALE_COOKIE = 'NEXT_LOCALE'
const SUPPORTED_LOCALES = ['zh', 'en']
const DEFAULT_LOCALE = 'zh'

function detectLocale(request: NextRequest): string {
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value
  if (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale)) {
    return cookieLocale
  }

  const acceptLang = request.headers.get('accept-language') || ''
  for (const part of acceptLang.split(',')) {
    const lang = part.split(';')[0].trim().toLowerCase()
    if (lang.startsWith('en')) return 'en'
    if (lang.startsWith('zh')) return 'zh'
  }
  return DEFAULT_LOCALE
}

export function middleware(request: NextRequest) {
  const requestId = getOrCreateRequestId(request.headers)
  const locale = detectLocale(request)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(REQUEST_ID_HEADER, requestId)
  requestHeaders.set('x-locale', locale)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })
  response.headers.set(REQUEST_ID_HEADER, requestId)

  if (!request.cookies.get(LOCALE_COOKIE)?.value) {
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: '/',
      maxAge: 365 * 24 * 60 * 60,
      sameSite: 'lax',
    })
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
