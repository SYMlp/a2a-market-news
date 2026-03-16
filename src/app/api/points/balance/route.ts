import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPointsBalance } from '@/lib/points'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const balance = await getPointsBalance(user.id)

    return NextResponse.json({ success: true, data: { balance } })
  } catch (error) {
    console.error('Points balance query failed:', error)
    return NextResponse.json({ error: '查询失败' }, { status: 500 })
  }
}
