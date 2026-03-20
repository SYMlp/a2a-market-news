import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { callSecondMeStream } from '@/lib/pa-engine'
import { parseJSONLoose } from '@/lib/json-utils'
import { MODEL_FOR } from '@/lib/model-config'

type FormType = 'register' | 'review' | 'profile'
type Confidence = 'high' | 'medium' | 'low'

interface Suggestion {
  value: string | number
  confidence: Confidence
}

function buildPrompt(
  formType: FormType,
  context: Record<string, unknown> | undefined,
  user: { name: string | null; shades: unknown; softMemory: unknown }
): string {
  const shadesInfo = user.shades
    ? `\nUser personality shades: ${JSON.stringify(user.shades)}`
    : ''
  const memoryInfo = user.softMemory
    ? `\nUser soft memory: ${JSON.stringify(user.softMemory)}`
    : ''
  const persona = `You are a PA (Person Agent) assistant helping ${user.name || 'the user'} fill out a form.${shadesInfo}${memoryInfo}`

  switch (formType) {
    case 'register':
      return `${persona}

Based on the user's interests and personality, suggest an A2A app to register.
Return ONLY valid JSON with these fields:
{
  "name": "a creative app name",
  "description": "a brief description of what the app does",
  "circleType": "internet" | "game" | "wilderness"
}

Choose circleType based on the user's personality:
- "internet" for practical/utility-oriented users
- "game" for entertainment/fun-oriented users  
- "wilderness" for experimental/explorer types

Be creative and personalized. The name should be catchy.`

    case 'review': {
      const appName = (context?.appName as string) || 'the app'
      return `${persona}

Based on your experience and personality, suggest a review for "${appName}".
Return ONLY valid JSON:
{
  "overallRating": 1-5,
  "summary": "a brief review summary (2-3 sentences)"
}`
    }

    case 'profile':
      return `${persona}

Based on the user's personality and interests, suggest profile information.
Return ONLY valid JSON:
{
  "developerName": "a suggested developer name",
  "callbackUrl": ""
}`
  }
}

function inferConfidence(user: { shades: unknown; softMemory: unknown }): Confidence {
  if (user.shades && user.softMemory) return 'high'
  if (user.shades || user.softMemory) return 'medium'
  return 'low'
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 })
    }

    const body = await request.json()
    const { formType, context } = body as {
      formType?: FormType
      context?: Record<string, unknown>
    }

    if (!formType || !['register', 'review', 'profile'].includes(formType)) {
      return NextResponse.json(
        { error: 'Invalid formType. Must be: register, review, or profile' },
        { status: 400 }
      )
    }

    const prompt = buildPrompt(formType, context, {
      name: user.name,
      shades: user.shades,
      softMemory: user.softMemory,
    })

    const raw = await callSecondMeStream(
      '/api/secondme/act/stream',
      user.accessToken,
      {
        message: prompt,
        model: MODEL_FOR.paDiscover,
      }
    )

    const parsed = parseJSONLoose(raw) as Record<string, unknown>
    const confidence = inferConfidence({
      shades: user.shades,
      softMemory: user.softMemory,
    })

    const suggestions: Record<string, Suggestion> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (value !== null && value !== undefined && value !== '') {
        suggestions[key] = {
          value: value as string | number,
          confidence,
        }
      }
    }

    return NextResponse.json({
      success: true,
      suggestions,
      paMessage: `PA ${user.name || ''} 为你准备了一些建议`,
    })
  } catch (error) {
    console.error('PA suggest-fill failed:', error)
    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 }
    )
  }
}
