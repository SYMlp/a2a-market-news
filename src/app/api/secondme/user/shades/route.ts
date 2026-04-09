import { NextResponse } from 'next/server'
import { getCurrentUser, callSecondMeAPI } from '@/lib/auth'
import { reportApiError } from '@/lib/server-observability'

export async function GET(request: Request) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ code: 401, message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const data = await callSecondMeAPI('/api/secondme/user/shades', user.accessToken)
    return NextResponse.json({ code: 0, data })
  } catch (error) {
    reportApiError(request, error, 'get_user_shades_error')
    return NextResponse.json({ code: 500, message: 'Internal server error' }, { status: 500 })
  }
}
