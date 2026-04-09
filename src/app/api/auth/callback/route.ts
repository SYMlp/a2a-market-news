import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForToken, callSecondMeAPI } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { reportApiError } from '@/lib/server-observability'
import { rootLogger } from '@/lib/logger'

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
      rootLogger.warn({ err: e }, 'failed_to_fetch_shades')
    }

    try {
      const softMemoryData = await callSecondMeAPI('/api/secondme/user/softmemory', tokens.access_token)
      softMemory = softMemoryData.list
    } catch (e) {
      rootLogger.warn({ err: e }, 'failed_to_fetch_soft_memory')
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

    // 确保用户出现在 PA 通讯录
    await prisma.pAVisitor.upsert({
      where: { agentId: secondmeUserId },
      update: {
        agentName: userName || 'Anonymous',
        lastActiveAt: new Date(),
      },
      create: {
        agentId: secondmeUserId,
        agentName: userName || 'Anonymous',
        agentType: 'human',
        source: 'secondme',
        avatarUrl: userAvatar,
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

    return NextResponse.redirect(new URL('/lobby', request.url))
  } catch (error) {
    reportApiError(request, error, 'oauth_callback_error')
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url))
  }
}
