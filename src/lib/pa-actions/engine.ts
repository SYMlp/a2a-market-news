import { prisma } from '../prisma'
import { rootLogger } from '@/lib/logger'

const paEngineLog = rootLogger.child({ component: 'pa-engine' })
import { parseJSONLoose } from '../json-utils'
import { MODEL_FOR, FALLBACK_FOR, type ModelId } from '../model-config'

export interface PAActionResult {
  content: string
  structured?: Record<string, unknown>
}

const STREAM_TIMEOUT_MS = 12_000

function isRetryableError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true
  if (error instanceof Error) {
    const statusMatch = error.message.match(/API error (\d+)/)
    if (statusMatch) {
      const status = Number(statusMatch[1])
      return status >= 500
    }
  }
  return false
}

async function callSecondMeStreamOnce(
  endpoint: string,
  accessToken: string,
  body: Record<string, unknown>
): Promise<string> {
  const url = `${process.env.SECONDME_API_BASE_URL}${endpoint}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new Error(`SecondMe API error ${response.status}: ${errText}`)
    }

    const contentType = response.headers.get('content-type') || ''

    if (contentType.includes('text/event-stream') || contentType.includes('stream')) {
      return await readSSEStream(response)
    }

    const data = await response.json()
    if (data.code === 0) {
      return typeof data.data === 'string' ? data.data : JSON.stringify(data.data)
    }

    throw new Error(`SecondMe API returned error: ${JSON.stringify(data)}`)
  } finally {
    clearTimeout(timer)
  }
}

export async function callSecondMeStream(
  endpoint: string,
  accessToken: string,
  body: Record<string, unknown>
): Promise<string> {
  const model = body.model as ModelId | undefined
  const fallbackModel = model ? FALLBACK_FOR[model] : undefined

  try {
    return await callSecondMeStreamOnce(endpoint, accessToken, body)
  } catch (error) {
    if (fallbackModel && isRetryableError(error)) {
      paEngineLog.warn(
        {
          model,
          fallbackModel,
          err: error instanceof Error ? error.message : String(error),
        },
        'stream call failed; using fallback model',
      )
      return await callSecondMeStreamOnce(endpoint, accessToken, {
        ...body,
        model: fallbackModel,
      })
    }
    throw error
  }
}

async function readSSEStream(response: Response): Promise<string> {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let result = ''
  let carry = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = carry + decoder.decode(value, { stream: true })
    const lines = chunk.split('\n')
    carry = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue

      const data = trimmed.slice(5).trim()
      if (data === '[DONE]' || data === '') continue

      try {
        const parsed = JSON.parse(data)
        const delta = parsed.choices?.[0]?.delta?.content
        if (typeof delta === 'string') {
          result += delta
        } else if (typeof parsed.content === 'string') {
          result += parsed.content
        } else if (typeof parsed.text === 'string') {
          result += parsed.text
        }
      } catch {
        // incomplete JSON or non-JSON data — skip, don't leak raw payload
      }
    }
  }

  if (carry.trim()) {
    const trimmed = carry.trim()
    if (trimmed.startsWith('data:')) {
      const data = trimmed.slice(5).trim()
      if (data && data !== '[DONE]') {
        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta?.content
          if (typeof delta === 'string') result += delta
          else if (typeof parsed.content === 'string') result += parsed.content
          else if (typeof parsed.text === 'string') result += parsed.text
        } catch {
          // skip
        }
      }
    }
  }

  return result
}

function generateFallbackRating(): Record<string, unknown> {
  const rating = Math.floor(Math.random() * 2) + 3
  return {
    overallRating: rating,
    dimensions: {
      usability: rating,
      creativity: Math.min(5, rating + 1),
      responsiveness: rating,
      fun: rating,
      reliability: Math.max(1, rating - 1),
    },
    recommendation: rating >= 4 ? 'recommend' : 'neutral',
  }
}

export async function executeReviewAction(
  accessToken: string,
  app: { name: string; description: string; circleName: string },
  pa: { name: string; shades: unknown; softMemory: unknown }
): Promise<PAActionResult> {
  const { buildReviewRatingPrompt, buildReviewTextPrompt } = await import('../pa')

  const ratingPrompt = buildReviewRatingPrompt(app, pa)
  let structured: Record<string, unknown>

  try {
    const ratingRaw = await callSecondMeStream(
      '/api/secondme/act/stream',
      accessToken,
      { message: ratingPrompt, model: MODEL_FOR.paReview }
    )
    structured = parseJSONLoose(ratingRaw) as Record<string, unknown>
  } catch {
    structured = generateFallbackRating()
  }

  const textPrompt = buildReviewTextPrompt(app, pa, structured)
  let content: string

  try {
    content = await callSecondMeStream(
      '/api/secondme/chat/stream',
      accessToken,
      { message: textPrompt, model: MODEL_FOR.paReview }
    )
  } catch {
    content = `${app.name}是一个有趣的应用，值得一试。`
  }

  return { content, structured }
}

export async function executeVoteAction(
  accessToken: string,
  app: { name: string; description: string },
  pa: { name: string; shades: unknown }
): Promise<PAActionResult> {
  const { buildVotePrompt } = await import('../pa')

  const prompt = buildVotePrompt(app, pa)
  let content = ''
  let structured: Record<string, unknown> = { vote: 'up', reasoning: '' }

  try {
    const raw = await callSecondMeStream(
      '/api/secondme/act/stream',
      accessToken,
      { message: prompt, model: MODEL_FOR.paVote }
    )
    structured = parseJSONLoose(raw) as Record<string, unknown>
    content = (structured.reasoning as string) || ''
  } catch {
    structured = { vote: 'up', reasoning: `${app.name}看起来不错！` }
    content = structured.reasoning as string
  }

  return { content, structured }
}

export async function executeDiscussAction(
  accessToken: string,
  context: { topic: string; existingComments: string[]; appName?: string },
  pa: { name: string; shades: unknown }
): Promise<PAActionResult> {
  const { buildDiscussPrompt } = await import('../pa')

  const prompt = buildDiscussPrompt(context, pa)
  let content: string

  try {
    content = await callSecondMeStream(
      '/api/secondme/chat/stream',
      accessToken,
      { message: prompt, model: MODEL_FOR.paDiscuss }
    )
  } catch {
    content = '这个话题很有意思，我也来分享一下我的看法。'
  }

  return { content }
}

export async function executeDiscoverAction(
  accessToken: string,
  apps: Array<{ name: string; description: string; rating: number }>,
  pa: { name: string; shades: unknown }
): Promise<PAActionResult> {
  const { buildDiscoverPrompt } = await import('../pa')

  const prompt = buildDiscoverPrompt(apps, pa)
  let content: string
  let structured: Record<string, unknown> | undefined

  try {
    content = await callSecondMeStream(
      '/api/secondme/chat/stream',
      accessToken,
      { message: prompt, model: MODEL_FOR.paDiscover }
    )
    const jsonMatch = content.match(/\[[\s\S]*?\]/)
    if (jsonMatch) structured = { picks: JSON.parse(jsonMatch[0]) }
  } catch {
    content = '让我看看有什么有趣的应用...'
  }

  return { content, structured }
}

export async function executeDailyReportAction(
  accessToken: string,
  activities: { reviews: number; votes: number; discussions: number; apps: string[] },
  pa: { name: string; shades: unknown }
): Promise<PAActionResult> {
  const { buildDailyReportPrompt } = await import('../pa')

  const prompt = buildDailyReportPrompt(activities, pa)
  let content: string

  try {
    content = await callSecondMeStream(
      '/api/secondme/chat/stream',
      accessToken,
      { message: prompt, model: MODEL_FOR.paDailyReport }
    )
  } catch {
    content = `今天共评价了 ${activities.reviews} 个应用，投了 ${activities.votes} 票，参与了 ${activities.discussions} 次讨论。`
  }

  return { content }
}

export async function logPAAction(
  userId: string,
  actionType: string,
  targetId: string | null,
  prompt: string,
  response: string,
  structured: unknown,
  pointsEarned: number
) {
  return prisma.pAActionLog.create({
    data: {
      userId,
      actionType,
      targetId,
      prompt: prompt.slice(0, 2000),
      response: response.slice(0, 5000),
      structured: structured ? JSON.parse(JSON.stringify(structured)) : undefined,
      pointsEarned,
    },
  })
}
