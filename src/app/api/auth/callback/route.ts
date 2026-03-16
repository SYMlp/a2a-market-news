import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForToken, callSecondMeAPI } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

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
    // 交换授权码获取 Token
    const tokens = await exchangeCodeForToken(code)

    // 获取用户信息
    const userInfo = await callSecondMeAPI('/api/secondme/user/info', tokens.access_token)

    const secondmeUserId = String(userInfo.userId)
    const userName = userInfo.name ?? null
    const userEmail = userInfo.email ?? null
    const userAvatar = userInfo.avatar ?? null

    // 获取 Shades 和 SoftMemory
    let shades = null
    let softMemory = null

    try {
      const shadesData = await callSecondMeAPI('/api/secondme/user/shades', tokens.access_token)
      shades = shadesData.shades
    } catch (e) {
      console.log('Failed to fetch shades:', e)
    }

    try {
      const softMemoryData = await callSecondMeAPI('/api/secondme/user/softmemory', tokens.access_token)
      softMemory = softMemoryData.list
    } catch (e) {
      console.log('Failed to fetch softMemory:', e)
    }

    // 计算 Token 过期时间
    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000)

    // 创建或更新用户
    const user = await prisma.user.upsert({
      where: { secondmeUserId },
      update: {
        email: userEmail,
        name: userName,
        avatarUrl: userAvatar,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: tokenExpiry,
        shades,
        softMemory,
      },
      create: {
        secondmeUserId,
        email: userEmail,
        name: userName,
        avatarUrl: userAvatar,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: tokenExpiry,
        shades,
        softMemory,
      },
    })

    // 设置会话 Cookie
    const cookieStore = await cookies()
    cookieStore.set('user_id', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 天
    })

    // 重定向到首页
    return NextResponse.redirect(new URL('/', request.url))
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url))
  }
}
