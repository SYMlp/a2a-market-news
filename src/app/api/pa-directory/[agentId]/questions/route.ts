import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/api-utils'
import { createPAQuestion, listPAQuestions } from '@/lib/pa-directory'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params
  const result = await listPAQuestions(agentId)

  if (!result.ok) {
    return apiError(result.error, result.status)
  }

  return apiSuccess(result.data)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params
  const body = await request.json()

  const result = await createPAQuestion(agentId, body)
  if (!result.ok) {
    return apiError(result.error, result.status)
  }

  return apiSuccess(result.data)
}
