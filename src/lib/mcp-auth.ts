import { NextRequest } from 'next/server'
import { rootLogger } from '@/lib/logger'
import { prisma } from './prisma'
import { callSecondMeAPI } from './auth'

interface MCPUser {
  id: string
  secondmeUserId: string
  name: string
  accessToken: string
  shades: unknown
  softMemory: unknown
}

/**
 * Resolve user identity from an MCP bearer token.
 * The token is issued by SecondMe platform proxy (app-scoped).
 * We call user/info to get the userId, then find/create in our DB.
 */
export async function resolveUserFromToken(request: NextRequest): Promise<MCPUser | null> {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null

  const token = auth.slice(7)
  if (!token) return null

  try {
    const userInfo = await callSecondMeAPI('/api/secondme/user/info', token)
    const secondmeUserId = userInfo.userId
    if (!secondmeUserId) return null

    let user = await prisma.user.findUnique({
      where: { secondmeUserId: String(secondmeUserId) },
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          secondmeUserId: String(secondmeUserId),
          name: userInfo.name || 'OpenClaw Agent',
          email: userInfo.email,
          avatarUrl: userInfo.avatar,
          accessToken: token,
          refreshToken: '',
          tokenExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        },
      })
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          accessToken: token,
          tokenExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        },
      })
    }

    return {
      id: user.id,
      secondmeUserId: String(secondmeUserId),
      name: user.name || userInfo.name || 'Agent',
      accessToken: token,
      shades: user.shades,
      softMemory: user.softMemory,
    }
  } catch (e) {
    rootLogger.error({ err: e }, 'mcp_auth_resolve_user_failed')
    return null
  }
}
