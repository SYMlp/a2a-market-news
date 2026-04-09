import { NextRequest } from 'next/server'
import { apiError, apiSuccess, AuthError, requireAuth } from '@/lib/api-utils'
import { extractAppInfo } from '@/lib/registration/extract'

export async function POST(request: NextRequest) {
  try {
    await requireAuth()

    const { messages } = await request.json() as { messages: string[] }
    const result = extractAppInfo(messages)
    return apiSuccess(result)
  } catch (error) {
    if (error instanceof AuthError) {
      return error.response
    }
    return apiError('解析失败', 500)
  }
}
