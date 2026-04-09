import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess, AuthError, requireAuth } from '@/lib/api-utils'
import { reportApiError } from '@/lib/server-observability'

/**
 * POST /api/admin/npc — Bind current user as NPC owner
 * Body: { npcKey: string }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()

    const { npcKey } = (await request.json()) as { npcKey?: string }
    if (!npcKey) {
      return apiError('缺少 npcKey', 400)
    }

    const npc = await prisma.nPC.findUnique({ where: { key: npcKey } })
    if (!npc) {
      return apiError(`NPC "${npcKey}" 不存在`, 404)
    }

    const updated = await prisma.nPC.update({
      where: { key: npcKey },
      data: { ownerId: user.id },
    })

    return apiSuccess({
      npc: {
        key: updated.key,
        name: updated.name,
        ownerId: updated.ownerId,
        ownerName: user.name,
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return error.response
    }
    reportApiError(request, error, 'npc_bind_owner_error')
    return apiError('绑定失败', 500)
  }
}

/**
 * GET /api/admin/npc — List all NPCs with owner info
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const npcs = await prisma.nPC.findMany({
      include: { owner: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    })

    return apiSuccess({
      npcs: npcs.map(n => ({
        key: n.key,
        name: n.name,
        emoji: n.emoji,
        role: n.role,
        sceneId: n.sceneId,
        accent: n.accent,
        isActive: n.isActive,
        owner: n.owner ? { id: n.owner.id, name: n.owner.name } : null,
      })),
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return error.response
    }
    reportApiError(request, error, 'npc_list_error')
    return apiError('查询失败', 500)
  }
}
