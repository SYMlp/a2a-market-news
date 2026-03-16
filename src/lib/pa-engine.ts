import { prisma } from './prisma'

export interface PAActionResult {
  content: string
  structured?: Record<string, unknown>
}

export async function callSecondMeStream(
  endpoint: string,
  accessToken: string,
  body: Record<string, unknown>
): Promise<string> {
  const url = `${process.env.SECONDME_API_BASE_URL}${endpoint}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`SecondMe API error ${response.status}: ${errText}`)
  }

  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('text/event-stream') || contentType.includes('stream')) {
    return readSSEStream(response)
  }

  const data = await response.json()
  if (data.code === 0) {
    return typeof data.data === 'string' ? data.data : JSON.stringify(data.data)
  }

  throw new Error(`SecondMe API returned error: ${JSON.stringify(data)}`)
}

async function readSSEStream(response: Response): Promise<string> {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let result = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    for (const line of chunk.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue

      const data = trimmed.slice(5).trim()
      if (data === '[DONE]' || data === '') continue

      try {
        const parsed = JSON.parse(data)
        result += parsed.content || parsed.text || parsed.data || ''
      } catch {
        result += data
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
  const { buildReviewRatingPrompt, buildReviewTextPrompt } = await import('./pa-prompts')

  const ratingPrompt = buildReviewRatingPrompt(app, pa)
  let structured: Record<string, unknown>

  try {
    const ratingRaw = await callSecondMeStream(
      '/api/secondme/act/stream',
      accessToken,
      { message: ratingPrompt }
    )
    structured = JSON.parse(ratingRaw)
  } catch {
    structured = generateFallbackRating()
  }

  const textPrompt = buildReviewTextPrompt(app, pa, structured)
  let content: string

  try {
    content = await callSecondMeStream(
      '/api/secondme/chat/stream',
      accessToken,
      { message: textPrompt }
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
  const { buildVotePrompt } = await import('./pa-prompts')

  const prompt = buildVotePrompt(app, pa)
  let content = ''
  let structured: Record<string, unknown> = { vote: 'up', reasoning: '' }

  try {
    const raw = await callSecondMeStream(
      '/api/secondme/act/stream',
      accessToken,
      { message: prompt }
    )
    structured = JSON.parse(raw)
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
  const { buildDiscussPrompt } = await import('./pa-prompts')

  const prompt = buildDiscussPrompt(context, pa)
  let content: string

  try {
    content = await callSecondMeStream(
      '/api/secondme/chat/stream',
      accessToken,
      { message: prompt }
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
  const { buildDiscoverPrompt } = await import('./pa-prompts')

  const prompt = buildDiscoverPrompt(apps, pa)
  let content: string
  let structured: Record<string, unknown> | undefined

  try {
    content = await callSecondMeStream(
      '/api/secondme/chat/stream',
      accessToken,
      { message: prompt }
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
  const { buildDailyReportPrompt } = await import('./pa-prompts')

  const prompt = buildDailyReportPrompt(activities, pa)
  let content: string

  try {
    content = await callSecondMeStream(
      '/api/secondme/chat/stream',
      accessToken,
      { message: prompt }
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
