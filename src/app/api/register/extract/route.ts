import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { extractAppInfo } from '@/lib/registration/extract'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const { messages } = await request.json() as { messages: string[] }
    const result = extractAppInfo(messages)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: '解析失败' }, { status: 500 })
  }
}
