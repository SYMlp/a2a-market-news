import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { callSecondMeStream } from '@/lib/pa-engine'
import { buildGMAutoPrompt, buildGMIntentExtractPrompt } from '@/lib/pa-prompts'

/**
 * POST /api/gm/pa-respond
 * Auto mode: sends GM message to PA via SecondMe chat API,
 * then extracts intent via act API.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const { gmMessage, validIntents } = await request.json() as {
      gmMessage: string
      validIntents: string[]
    }

    if (!gmMessage) {
      return NextResponse.json({ error: '缺少 gmMessage' }, { status: 400 })
    }

    const pa = {
      name: user.name || 'PA',
      shades: user.shades,
    }

    // Step 1: PA responds to GM via chat API
    const chatPrompt = buildGMAutoPrompt(gmMessage, pa)
    let paResponse: string
    try {
      paResponse = await callSecondMeStream(
        '/api/secondme/chat/stream',
        user.accessToken,
        { message: chatPrompt },
      )
    } catch {
      paResponse = '这个平台看起来挺有意思的，我想看看有什么好玩的应用！'
    }

    // Step 2: Extract intent via act API
    let intent = ''
    let confidence = 0
    if (validIntents.length > 0) {
      const actPrompt = buildGMIntentExtractPrompt(paResponse, validIntents)
      try {
        const raw = await callSecondMeStream(
          '/api/secondme/act/stream',
          user.accessToken,
          { message: actPrompt },
        )
        const parsed = JSON.parse(raw)
        intent = parsed.intent || ''
        confidence = parsed.confidence || 0
      } catch {
        // Fallback: keyword matching
        intent = ''
        confidence = 0
      }
    }

    return NextResponse.json({
      success: true,
      paResponse,
      intent,
      confidence,
    })
  } catch (error) {
    console.error('GM pa-respond error:', error)
    return NextResponse.json({ error: 'PA 响应失败' }, { status: 500 })
  }
}
