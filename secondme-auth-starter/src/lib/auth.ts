import { cookies } from 'next/headers'

export interface SecondMeTokens {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

export interface SessionUser {
  secondmeUserId: string
  name: string | null
  email: string | null
  avatarUrl: string | null
  accessToken: string
  refreshToken: string
  tokenExpiresAt: number
}

export function getAuthorizationUrl(): string {
  const params = new URLSearchParams({
    client_id: process.env.SECONDME_CLIENT_ID!,
    redirect_uri: process.env.SECONDME_REDIRECT_URI!,
    response_type: 'code',
    scope: 'user.info user.info.shades user.info.softmemory chat note.add voice',
  })

  return `${process.env.SECONDME_OAUTH_URL}?${params.toString()}`
}

export async function exchangeCodeForToken(code: string): Promise<SecondMeTokens> {
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

  // SecondMe API 返回格式: {code: 0, data: {...}}，字段名是 camelCase
  if (data.code === 0) {
    return {
      access_token: data.data.accessToken,
      refresh_token: data.data.refreshToken,
      expires_in: data.data.expiresIn,
      token_type: data.data.tokenType,
    }
  }

  throw new Error(`Token exchange failed: ${JSON.stringify(data)}`)
}

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

  if (data.code === 0) {
    return data.data
  }

  throw new Error(`API call failed: ${JSON.stringify(data)}`)
}

// ─── Session 管理（基于 Cookie，无数据库） ───

const SESSION_COOKIE = 'secondme_session'

function encodeSession(user: SessionUser): string {
  return Buffer.from(JSON.stringify(user)).toString('base64')
}

function decodeSession(value: string): SessionUser | null {
  try {
    return JSON.parse(Buffer.from(value, 'base64').toString('utf-8'))
  } catch {
    return null
  }
}

export async function setSession(user: SessionUser) {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, encodeSession(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 天
  })
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const value = cookieStore.get(SESSION_COOKIE)?.value
  if (!value) return null
  return decodeSession(value)
}

export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}
