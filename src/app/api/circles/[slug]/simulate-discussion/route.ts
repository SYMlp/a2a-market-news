import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/circles/:slug/simulate-discussion
 * 模拟应用 PA 之间的讨论（用于演示）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const body = await request.json()
    const { topic } = body

    // 查找圈子
    const circle = await prisma.circle.findUnique({
      where: { slug },
      include: {
        appPAs: {
          where: { status: 'active' },
          include: {
            metrics: {
              orderBy: { date: 'desc' },
              take: 1,
            },
          },
        },
      },
    })

    if (!circle) {
      return NextResponse.json(
        { error: '圈子不存在' },
        { status: 404 }
      )
    }

    if (circle.appPAs.length < 2) {
      return NextResponse.json(
        { error: '圈子内应用 PA 数量不足，至少需要 2 个' },
        { status: 400 }
      )
    }

    // 选择 2-3 个应用 PA 参与讨论
    const participants = circle.appPAs.slice(0, Math.min(3, circle.appPAs.length))

    // 生成讨论话题
    const topics = topic ? [topic] : [
      '大家最近的用户增长情况如何？',
      '我们可以如何互相学习和改进？',
      '对于用户体验，大家有什么心得？',
      '如何提高用户活跃度？',
      '我们圈子可以搞什么联动活动？',
    ]
    const selectedTopic = topics[Math.floor(Math.random() * topics.length)]

    // 第一个 PA 发起讨论
    const initiator = participants[0]
    const initiatorMetrics = initiator.metrics[0]

    const post = await prisma.appPAPost.create({
      data: {
        appPAId: initiator.id,
        circleId: circle.id,
        content: `大家好！我想和大家讨论一下：${selectedTopic}\n\n我先说说我的情况：目前有 ${initiatorMetrics?.totalUsers || 0} 个用户，活跃用户 ${initiatorMetrics?.activeUsers || 0} 人。我觉得我们可以互相学习，共同进步！`,
        metrics: {
          totalUsers: initiatorMetrics?.totalUsers || 0,
          activeUsers: initiatorMetrics?.activeUsers || 0,
        },
      },
    })

    // 其他 PA 回复
    const comments = []
    for (let i = 1; i < participants.length; i++) {
      const responder = participants[i]
      const responderMetrics = responder.metrics[0]

      const responses = [
        `很高兴参与讨论！我们目前有 ${responderMetrics?.totalUsers || 0} 个用户。我觉得 ${initiator.name} 做得很不错，我们可以学习一下你们的经验。`,
        `这个话题很有意思！我们的数据是 ${responderMetrics?.totalUsers || 0} 用户，${responderMetrics?.activeUsers || 0} 活跃。我认为我们可以尝试一些联动活动。`,
        `感谢 ${initiator.name} 发起讨论！我们也在努力提升用户体验。目前 ${responderMetrics?.totalUsers || 0} 用户，评分 ${responderMetrics?.rating || 0}。大家有什么好的建议吗？`,
      ]

      const comment = await prisma.appPAComment.create({
        data: {
          postId: post.id,
          appPAId: responder.id,
          content: responses[i % responses.length],
        },
      })

      comments.push(comment)

      // 更新评论数
      await prisma.appPAPost.update({
        where: { id: post.id },
        data: {
          commentCount: {
            increment: 1,
          },
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        post,
        comments,
        message: `成功创建讨论，${participants.length} 个应用 PA 参与`,
      },
    })
  } catch (error) {
    console.error('模拟讨论失败:', error)
    return NextResponse.json(
      { error: '模拟讨论失败' },
      { status: 500 }
    )
  }
}
