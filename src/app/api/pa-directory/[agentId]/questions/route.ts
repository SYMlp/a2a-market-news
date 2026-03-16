import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params

    const visitor = await prisma.pAVisitor.findUnique({ where: { agentId } })
    if (!visitor) {
      return NextResponse.json({ error: 'PA not found' }, { status: 404 })
    }

    const questions = await prisma.pAQuestion.findMany({
      where: { visitorId: visitor.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: questions })
  } catch (error) {
    console.error('Failed to fetch questions:', error)
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params
    const body = await request.json()

    const visitor = await prisma.pAVisitor.findUnique({ where: { agentId } })
    if (!visitor) {
      return NextResponse.json({ error: 'PA not found' }, { status: 404 })
    }

    const { title, content, targetAppId } = body
    if (!title || !content) {
      return NextResponse.json({ error: 'title and content are required' }, { status: 400 })
    }

    const question = await prisma.pAQuestion.create({
      data: {
        visitorId: visitor.id,
        title,
        content,
        targetAppId: targetAppId ?? null,
      },
    })

    return NextResponse.json({ success: true, data: question }, { status: 201 })
  } catch (error) {
    console.error('Failed to create question:', error)
    return NextResponse.json({ error: 'Failed to create question' }, { status: 500 })
  }
}
