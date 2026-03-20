import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

const PAGE_SIZE = 12
const VALID_CATEGORIES = ['practice', 'showcase', 'tip']

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const tag = searchParams.get('tag')
    const category = searchParams.get('category')
    const authorId = searchParams.get('authorId')

    const user = await getCurrentUser()
    const isOwnQuery = authorId && user?.id === authorId

    const where: Record<string, unknown> = isOwnQuery ? {} : { status: 'published' }
    if (category && VALID_CATEGORIES.includes(category)) {
      where.category = category
    }
    if (authorId) {
      where.authorId = authorId
    }
    if (tag) {
      where.tags = { array_contains: tag }
    }

    const [practices, total] = await Promise.all([
      prisma.developerPractice.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.developerPractice.count({ where }),
    ])

    return NextResponse.json({ practices, total, page })
  } catch (error) {
    console.error('List practices failed:', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 })
    }
    if (!user.isDeveloper) {
      return NextResponse.json({ error: 'Not a developer' }, { status: 403 })
    }

    const body = await request.json()
    const { title, content, summary, category, tags, keySteps, applicableTo, status } = body

    if (!title || !content || !summary || !category || !Array.isArray(tags)) {
      return NextResponse.json(
        { error: 'Missing required fields: title, content, summary, category, tags (array)' },
        { status: 400 },
      )
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 },
      )
    }

    const practice = await prisma.developerPractice.create({
      data: {
        authorId: user.id,
        title,
        content,
        summary,
        category,
        tags,
        keySteps: keySteps ?? undefined,
        applicableTo: applicableTo ?? undefined,
        status: status === 'draft' ? 'draft' : 'published',
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    })

    return NextResponse.json({ success: true, data: practice })
  } catch (error) {
    console.error('Create practice failed:', error)
    return NextResponse.json({ error: 'Creation failed' }, { status: 500 })
  }
}
