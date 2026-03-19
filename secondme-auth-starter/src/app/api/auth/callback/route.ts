import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForToken, callSecondMeAPI, setSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL(`/?error=${error}`, request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', request.url))
  }

  try {
    const tokens = await exchangeCodeForToken(code)

    const userInfo = await callSecondMeAPI('/api/secondme/user/info', tokens.access_token)

    await setSession({
      secondmeUserId: String(userInfo.userId),
      name: userInfo.name ?? null,
      email: userInfo.email ?? null,
      avatarUrl: userInfo.avatar ?? null,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: Date.now() + tokens.expires_in * 1000,
    })

    // 登录成功后跳转到的页面，按需修改
    return NextResponse.redirect(new URL('/', request.url))
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url))
  }
}
