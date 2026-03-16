import { NextResponse } from 'next/server'
import { getCurrentUser, callSecondMeAPI } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ code: 401, message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const data = await callSecondMeAPI('/api/secondme/user/info', user.accessToken)
    return NextResponse.json({ code: 0, data })
  } catch (error) {
    console.error('Get user info error:', error)
    return NextResponse.json({ code: 500, message: 'Internal server error' }, { status: 500 })
  }
}
