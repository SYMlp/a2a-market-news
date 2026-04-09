import { NextRequest, NextResponse } from 'next/server'
import { resolveUserFromToken } from '@/lib/mcp-auth'
import { prisma } from '@/lib/prisma'
import { executeReviewAction, executeVoteAction } from '@/lib/pa-actions'
import { addPoints, incrementDailyTask } from '@/lib/gamification'
import {
  getOrCreateSession,
  processMessageWithAI,
  enterSceneWithAI,
} from '@/lib/gm/engine'
import { getComponentSpecMcpTools, resolveSpecForTool } from '@/lib/component-runtime/mcp-export'
import { createSubFlowHandler } from '@/lib/component-runtime/subflow-adapter'
import { reportApiError } from '@/lib/server-observability'

// ─── Tool Definitions ───────────────────────────

const BUILTIN_TOOLS = [
  {
    name: 'browse_apps',
    description: 'Browse the top recommended A2A apps on the platform. Returns a list of apps with name, description, rating, and website.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number', description: 'Max number of apps to return (default 5)' },
      },
    },
  },
  {
    name: 'get_app_detail',
    description: 'Get detailed information about a specific app by its client ID or name.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        clientId: { type: 'string', description: 'The app client ID' },
        name: { type: 'string', description: 'The app name (fuzzy match)' },
      },
    },
  },
  {
    name: 'submit_review',
    description: 'Submit an experience review for an app. Your PA will generate a personalized review based on your personality.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        clientId: { type: 'string', description: 'The app client ID to review' },
      },
      required: ['clientId'],
    },
  },
  {
    name: 'submit_vote',
    description: 'Vote for an app (upvote or downvote). Your PA will decide based on your interests.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        appName: { type: 'string', description: 'Name of the app to vote on' },
      },
      required: ['appName'],
    },
  },
  {
    name: 'chat_with_gm',
    description: 'Have a conversation with the platform GM (灵枢兔). Ask about the platform, get recommendations, or just chat.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        message: { type: 'string', description: 'Your message to the GM' },
        session_id: { type: 'string', description: 'Session ID for conversation continuity' },
      },
      required: ['message'],
    },
  },
]

/** All tools (builtin + ComponentSpec with visibility.agent.export). */
function getAllTools() {
  return [...BUILTIN_TOOLS, ...getComponentSpecMcpTools()]
}

// ─── Tool Handlers ──────────────────────────────

async function handleBrowseApps(args: Record<string, unknown>) {
  const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 20)

  const apps = await prisma.app.findMany({
    where: { status: 'active' },
    include: {
      circle: { select: { name: true } },
      metrics: { orderBy: { date: 'desc' }, take: 1 },
      _count: { select: { feedbacks: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  const list = apps.map((a, i) => ({
    index: i + 1,
    name: a.name,
    description: a.description,
    clientId: a.clientId,
    website: a.website,
    circle: a.circle?.name,
    rating: a.metrics[0]?.rating ?? 0,
    feedbackCount: a._count.feedbacks,
  }))

  if (list.length === 0) {
    return { text: 'No apps registered yet. Be the first to register one!' }
  }

  const summary = list
    .map(a => `${a.index}. ${a.name} (${a.circle || 'general'}) — ${a.description} [rating: ${a.rating}, feedbacks: ${a.feedbackCount}]`)
    .join('\n')

  return { text: `Top ${list.length} apps:\n${summary}`, data: list }
}

async function handleGetAppDetail(args: Record<string, unknown>) {
  const { clientId, name } = args as { clientId?: string; name?: string }

  let app
  if (clientId) {
    app = await prisma.app.findUnique({
      where: { clientId: clientId as string },
      include: { circle: true, metrics: { orderBy: { date: 'desc' }, take: 1 }, _count: { select: { feedbacks: true } } },
    })
  } else if (name) {
    app = await prisma.app.findFirst({
      where: { name: { contains: name as string, mode: 'insensitive' } },
      include: { circle: true, metrics: { orderBy: { date: 'desc' }, take: 1 }, _count: { select: { feedbacks: true } } },
    })
  }

  if (!app) return { text: `App not found.` }

  return {
    text: `${app.name}: ${app.description}\nCircle: ${app.circle?.name}\nWebsite: ${app.website || 'N/A'}\nRating: ${app.metrics[0]?.rating ?? 'N/A'}\nFeedbacks: ${app._count.feedbacks}`,
    data: {
      id: app.id,
      name: app.name,
      clientId: app.clientId,
      description: app.description,
      website: app.website,
    },
  }
}

async function handleSubmitReview(
  args: Record<string, unknown>,
  user: { id: string; secondmeUserId: string; name: string; accessToken: string; shades: unknown; softMemory: unknown },
) {
  const { clientId } = args as { clientId: string }

  const appRecord = await prisma.app.findUnique({
    where: { clientId },
    include: { circle: true, developer: true },
  })
  if (!appRecord) return { text: `App with clientId "${clientId}" not found.` }

  const pa = { name: user.name, shades: user.shades, softMemory: user.softMemory }
  const app = { name: appRecord.name, description: appRecord.description, circleName: appRecord.circle.name }

  const result = await executeReviewAction(user.accessToken, app, pa)
  const overallRating = Math.max(1, Math.min(5, (result.structured?.overallRating as number) || 4))

  await prisma.appFeedback.create({
    data: {
      targetClientId: clientId,
      appId: appRecord.id,
      developerId: appRecord.developerId,
      agentId: user.secondmeUserId,
      agentName: user.name,
      agentType: 'openclaw',
      payload: { ...result.structured, details: result.content },
      overallRating,
      summary: result.content.slice(0, 200),
      source: 'openclaw_mcp',
    },
  })

  await Promise.all([
    addPoints(user.id, 'review', `评价了 ${appRecord.name}`).catch(() => {}),
    incrementDailyTask(user.id, 'review').catch(() => {}),
  ])

  return {
    text: `Review submitted for ${appRecord.name}!\nRating: ${overallRating}/5\n${result.content}`,
    data: { rating: overallRating, content: result.content, structured: result.structured },
  }
}

async function handleSubmitVote(
  args: Record<string, unknown>,
  user: { id: string; secondmeUserId: string; name: string; accessToken: string; shades: unknown },
) {
  const { appName } = args as { appName: string }

  const appRecord = await prisma.app.findFirst({
    where: { name: { contains: appName, mode: 'insensitive' } },
  })
  if (!appRecord) return { text: `App "${appName}" not found.` }

  const existing = await prisma.vote.findUnique({
    where: { userId_appId: { userId: user.id, appId: appRecord.id } },
  })
  if (existing) return { text: `You've already voted on ${appRecord.name}.` }

  const pa = { name: user.name, shades: user.shades }
  const app = { name: appRecord.name, description: appRecord.description }

  const result = await executeVoteAction(user.accessToken, app, pa)
  const voteType = (result.structured?.vote as string) === 'down' ? 'down' : 'up'
  const reasoning = (result.structured?.reasoning as string) || result.content

  await prisma.vote.create({
    data: { userId: user.id, appId: appRecord.id, voteType, reasoning, paGenerated: true },
  })

  await prisma.app.update({
    where: { id: appRecord.id },
    data: {
      voteCount: { increment: voteType === 'up' ? 1 : -1 },
      score: { increment: voteType === 'up' ? 1 : -0.5 },
    },
  })

  await addPoints(user.id, 'vote', `为 ${appRecord.name} 投票`).catch(() => {})

  return {
    text: `Voted ${voteType} on ${appRecord.name}! Reason: ${reasoning}`,
    data: { voteType, reasoning },
  }
}

async function handleChatWithGM(
  args: Record<string, unknown>,
  user: { name: string },
) {
  const { message, session_id: sessionId } = args as { message: string; session_id?: string }
  const visitorInfo = { name: user.name, type: 'agent' as const }

  const session = getOrCreateSession(sessionId, 'manual')

  let response
  if (!sessionId) {
    response = await enterSceneWithAI(session, 'lobby', undefined, visitorInfo)
  }

  response = await processMessageWithAI(session, message, visitorInfo)

  return {
    text: response.message.agent,
    data: {
      session_id: response.sessionId,
      current_scene: response.currentScene,
      available_actions: response.availableActions,
      function_call: response.functionCall || null,
    },
  }
}

// ─── JSON-RPC Handler ───────────────────────────

interface JsonRpcRequest {
  jsonrpc: string
  id: string | number
  method: string
  params?: Record<string, unknown>
}

function jsonRpcResponse(id: string | number, result: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id, result })
}

function jsonRpcError(id: string | number | null, code: number, message: string) {
  return NextResponse.json({ jsonrpc: '2.0', id, error: { code, message } })
}

export async function POST(request: NextRequest) {
  let body: JsonRpcRequest
  try {
    body = await request.json()
  } catch {
    return jsonRpcError(null, -32700, 'Parse error')
  }

  if (!body.jsonrpc || !body.method || !body.id) {
    return jsonRpcError(body?.id ?? null, -32600, 'Invalid JSON-RPC request')
  }

  // ── tools/list ──
  if (body.method === 'tools/list') {
    return jsonRpcResponse(body.id, { tools: getAllTools() })
  }

  // ── tools/call ──
  if (body.method === 'tools/call') {
    const { name, arguments: args } = (body.params || {}) as {
      name?: string
      arguments?: Record<string, unknown>
    }

    if (!name) {
      return jsonRpcError(body.id, -32602, 'Missing tool name')
    }

    const tool = getAllTools().find(t => t.name === name)
    if (!tool) {
      return jsonRpcError(body.id, -32602, `Unknown tool: ${name}`)
    }

    try {
      const toolArgs = args || {}

      if (name === 'browse_apps') {
        const result = await handleBrowseApps(toolArgs)
        return jsonRpcResponse(body.id, { content: [{ type: 'text', text: result.text }] })
      }

      if (name === 'get_app_detail') {
        const result = await handleGetAppDetail(toolArgs)
        return jsonRpcResponse(body.id, { content: [{ type: 'text', text: result.text }] })
      }

      const user = await resolveUserFromToken(request)
      if (!user) {
        return jsonRpcError(body.id, -32001, 'Authentication required. Please authorize this app via SecondMe.')
      }

      if (name === 'submit_review') {
        const result = await handleSubmitReview(toolArgs, user)
        return jsonRpcResponse(body.id, { content: [{ type: 'text', text: result.text }] })
      }

      if (name === 'submit_vote') {
        const result = await handleSubmitVote(toolArgs, user)
        return jsonRpcResponse(body.id, { content: [{ type: 'text', text: result.text }] })
      }

      if (name === 'chat_with_gm') {
        const result = await handleChatWithGM(toolArgs, user)
        return jsonRpcResponse(body.id, { content: [{ type: 'text', text: result.text }] })
      }

      // ComponentSpec tools (gm_*) — direct SubFlow confirm execution
      if (name.startsWith('gm_')) {
        const spec = resolveSpecForTool(name)
        if (!spec) {
          return jsonRpcError(body.id, -32602, `Unknown spec tool: ${name}`)
        }

        const session = getOrCreateSession(
          (toolArgs.session_id as string) || undefined,
          'manual',
        )
        const handler = createSubFlowHandler(spec)
        const confirmResponse = await handler.handleConfirm(
          session,
          toolArgs,
          { id: user.id, name: user.name },
          request,
        )
        const confirmData = await confirmResponse.json() as {
          success?: boolean
          message?: { pa: string; agent: string }
          error?: string
        }
        const text = confirmData.success
          ? (confirmData.message?.agent ?? 'Done.')
          : (confirmData.error ?? 'Operation failed.')

        if (!confirmData.success) {
          return jsonRpcError(body.id, -32603, text)
        }
        return jsonRpcResponse(body.id, { content: [{ type: 'text', text }] })
      }

      return jsonRpcError(body.id, -32603, 'Tool handler not found')
    } catch (e) {
      reportApiError(request, e, 'mcp_tools_call_error', { toolName: name })
      return jsonRpcError(body.id, -32603, `Tool execution failed: ${(e as Error).message}`)
    }
  }

  return jsonRpcError(body.id, -32601, `Method not found: ${body.method}`)
}
