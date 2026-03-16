import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/admin/npc — Bind current user as NPC owner
 * Body: { npcKey: string }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const { npcKey } = (await request.json()) as { npcKey?: string }
    if (!npcKey) {
      return NextResponse.json({ error: '缺少 npcKey' }, { status: 400 })
    }

    const npc = await prisma.nPC.findUnique({ where: { key: npcKey } })
    if (!npc) {
      return NextResponse.json({ error: `NPC "${npcKey}" 不存在` }, { status: 404 })
    }

    const updated = await prisma.nPC.update({
      where: { key: npcKey },
      data: { ownerId: user.id },
    })

    return NextResponse.json({
      success: true,
      npc: {
        key: updated.key,
        name: updated.name,
        ownerId: updated.ownerId,
        ownerName: user.name,
      },
    })
  } catch (error) {
    console.error('NPC bind-owner error:', error)
    return NextResponse.json({ error: '绑定失败' }, { status: 500 })
  }
}

/**
 * GET /api/admin/npc — List all NPCs with owner info
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const npcs = await prisma.nPC.findMany({
      include: { owner: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({
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
    console.error('NPC list error:', error)
    return NextResponse.json({ error: '查询失败' }, { status: 500 })
  }
}
