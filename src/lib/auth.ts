import { cookies } from 'next/headers'
import { rootLogger } from '@/lib/logger'
import { prisma } from './prisma'

export interface SecondMeTokens {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

export interface SecondMeUser {
  userId: string
  email?: string
  name?: string
  avatar?: string
  bio?: string
  selfIntroduction?: string
  profileCompleteness?: number
  route?: string
}

// 获取 OAuth 授权 URL
export function getAuthorizationUrl(): string {
  const params = new URLSearchParams({
    client_id: process.env.SECONDME_CLIENT_ID!,
    redirect_uri: process.env.SECONDME_REDIRECT_URI!,
    response_type: 'code',
    scope: 'user.info user.info.shades user.info.softmemory chat note.add voice',
  })

  return `${process.env.SECONDME_OAUTH_URL}?${params.toString()}`
}

// 交换授权码获取 Token
export async function exchangeCodeForToken(code: string): Promise<SecondMeTokens> {
  // 必须使用 application/x-www-form-urlencoded 格式
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.SECONDME_CLIENT_ID!,
    client_secret: process.env.SECONDME_CLIENT_SECRET!,
    code,
    redirect_uri: process.env.SECONDME_REDIRECT_URI!,
  })

  const response = await fetch(process.env.SECONDME_TOKEN_ENDPOINT!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${errorText}`)
  }

  const data = await response.json()

  // SecondMe API 返回格式: {code: 0, data: {...}}
  if (data.code === 0) {
    // 响应字段名是 camelCase
    return {
      access_token: data.data.accessToken,
      refresh_token: data.data.refreshToken,
      expires_in: data.data.expiresIn,
      token_type: data.data.tokenType,
    }
  }

  throw new Error(`Token exchange failed: ${JSON.stringify(data)}`)
}

// 刷新 Access Token
export async function refreshAccessToken(refreshToken: string): Promise<SecondMeTokens> {
  // 必须使用 application/x-www-form-urlencoded 格式
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.SECONDME_CLIENT_ID!,
    client_secret: process.env.SECONDME_CLIENT_SECRET!,
    refresh_token: refreshToken,
  })

  const response = await fetch(process.env.SECONDME_TOKEN_ENDPOINT!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.statusText}`)
  }

  const data = await response.json()

  if (data.code === 0) {
    return {
      access_token: data.data.accessToken,
      refresh_token: data.data.refreshToken,
      expires_in: data.data.expiresIn,
      token_type: data.data.tokenType,
    }
  }

  throw new Error(`Token refresh failed: ${JSON.stringify(data)}`)
}

// 获取当前登录用户
export async function getCurrentUser() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('user_id')?.value

  if (!userId) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  // 检查 Token 是否过期
  if (user && user.tokenExpiresAt < new Date()) {
    try {
      // 刷新 Token
      const tokens = await refreshAccessToken(user.refreshToken)

      // 更新数据库
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        },
      })

      return updatedUser
    } catch (error) {
      rootLogger.error({ err: error }, 'token_refresh_failed')
      // Token 刷新失败，清除 Cookie
      cookieStore.delete('user_id')
      return null
    }
  }

  return user
}

// 调用 SecondMe API
export async function callSecondMeAPI(
  endpoint: string,
  accessToken: string,
  options?: RequestInit
) {
  const url = `${process.env.SECONDME_API_BASE_URL}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`API call failed: ${response.statusText}`)
  }

  const data = await response.json()

  // SecondMe API 返回格式: {code: 0, data: {...}}
  if (data.code === 0) {
    return data.data
  }

  throw new Error(`API call failed: ${JSON.stringify(data)}`)
}
