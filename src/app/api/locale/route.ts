import { NextRequest, NextResponse } from 'next/server'

const LOCALE_COOKIE = 'NEXT_LOCALE'
const SUPPORTED = ['zh', 'en']

export async function POST(request: NextRequest) {
  const { locale } = await request.json()
  if (!SUPPORTED.includes(locale)) {
    return NextResponse.json({ error: 'Unsupported locale' }, { status: 400 })
  }

  const response = NextResponse.json({ success: true, locale })
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 365 * 24 * 60 * 60,
    sameSite: 'lax',
  })
  return response
}
