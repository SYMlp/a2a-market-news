import { prisma } from '@/lib/prisma'
import { rootLogger } from '@/lib/logger'
import { err, ok, type ServiceResult } from '@/lib/service-result'

export async function listCircles(): Promise<ServiceResult<Awaited<ReturnType<typeof fetchCirclesData>>>> {
  try {
    const circles = await fetchCirclesData()
    return ok(circles)
  } catch (e) {
    rootLogger.error({ err: e }, 'fetch_circles_failed')
    return err('获取失败', 500)
  }
}

async function fetchCirclesData() {
  return prisma.circle.findMany({
    include: {
      _count: {
        select: {
          apps: true,
          posts: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  })
}

export async function getCircleApps(
  slug: string,
  page: number,
  limit: number,
): Promise<
  ServiceResult<{
    circle: NonNullable<Awaited<ReturnType<typeof prisma.circle.findUnique>>>
    apps: Awaited<ReturnType<typeof prisma.app.findMany>>
    pagination: { page: number; limit: number; total: number; totalPages: number }
  }>
> {
  try {
    const skip = (page - 1) * limit
    const circle = await prisma.circle.findUnique({ where: { slug } })
    if (!circle) {
      return err('圈子不存在', 404)
    }

    const [apps, total] = await Promise.all([
      prisma.app.findMany({
        where: {
          circleId: circle.id,
          status: 'active',
        },
        include: {
          developer: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          metrics: {
            orderBy: { date: 'desc' },
            take: 1,
          },
          _count: {
            select: {
              posts: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.app.count({
        where: {
          circleId: circle.id,
          status: 'active',
        },
      }),
    ])

    return ok({
      circle,
      apps,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (e) {
    rootLogger.error({ err: e }, 'fetch_circle_apps_failed')
    return err('获取失败', 500)
  }
}

export async function getCircleLeaderboard(slug: string, sortBy: string, limit: number) {
  try {
    const circle = await prisma.circle.findUnique({ where: { slug } })
    if (!circle) {
      return err('圈子不存在', 404)
    }

    const apps = await prisma.app.findMany({
      where: {
        circleId: circle.id,
        status: 'active',
      },
      include: {
        developer: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        metrics: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    })

    const sortedApps = apps
      .filter(app => app.metrics.length > 0)
      .map(app => ({
        ...app,
        latestMetrics: app.metrics[0],
      }))
      .sort((a, b) => {
        if (sortBy === 'votes') {
          return (b.voteCount ?? 0) - (a.voteCount ?? 0)
        }
        const aValue =
          (a.latestMetrics[sortBy as keyof typeof a.latestMetrics] as number) || 0
        const bValue =
          (b.latestMetrics[sortBy as keyof typeof b.latestMetrics] as number) || 0
        return bValue - aValue
      })
      .slice(0, limit)
      .map((app, index) => ({
        rank: index + 1,
        ...app,
      }))

    const circleStats = {
      totalApps: apps.length,
      totalUsers: apps.reduce((sum, app) => {
        const metrics = app.metrics[0]
        return sum + (metrics?.totalUsers || 0)
      }, 0),
      avgRating:
        apps.reduce((sum, app) => {
          const metrics = app.metrics[0]
          return sum + (metrics?.rating || 0)
        }, 0) / apps.length || 0,
    }

    return ok({
      circle,
      stats: circleStats,
      leaderboard: sortedApps,
      sortBy,
    })
  } catch (e) {
    rootLogger.error({ err: e }, 'fetch_circle_leaderboard_failed')
    return err('获取失败', 500)
  }
}

export async function getCirclePosts(
  slug: string,
  page: number,
  limit: number,
): Promise<
  ServiceResult<{
    circle: NonNullable<Awaited<ReturnType<typeof prisma.circle.findUnique>>>
    posts: Awaited<ReturnType<typeof prisma.appPost.findMany>>
    pagination: { page: number; limit: number; total: number; totalPages: number }
  }>
> {
  try {
    const skip = (page - 1) * limit
    const circle = await prisma.circle.findUnique({ where: { slug } })
    if (!circle) {
      return err('圈子不存在', 404)
    }

    const [posts, total] = await Promise.all([
      prisma.appPost.findMany({
        where: {
          circleId: circle.id,
        },
        include: {
          app: {
            include: {
              circle: true,
            },
          },
          circle: true,
          comments: {
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
              app: {
                select: {
                  id: true,
                  name: true,
                  logo: true,
                  circle: {
                    select: {
                      name: true,
                      icon: true,
                    },
                  },
                },
              },
              user: {
                select: {
                  id: true,
                  name: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.appPost.count({
        where: {
          circleId: circle.id,
        },
      }),
    ])

    return ok({
      circle,
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (e) {
    rootLogger.error({ err: e }, 'fetch_circle_posts_failed')
    return err('获取失败', 500)
  }
}

export async function createCirclePost(
  slug: string,
  body: { appPAId?: string; appId?: string; content: unknown; metrics?: unknown },
): Promise<ServiceResult<Awaited<ReturnType<typeof prisma.appPost.create>>>> {
  try {
    const { appPAId, appId, content, metrics } = body
    const resolvedAppId = appId ?? appPAId

    if (!resolvedAppId || !content) {
      return err('缺少必填字段: appId, content', 400)
    }

    const circle = await prisma.circle.findUnique({ where: { slug } })
    if (!circle) {
      return err('圈子不存在', 404)
    }

    const appRecord = await prisma.app.findUnique({
      where: { id: resolvedAppId },
    })
    if (!appRecord) {
      return err('应用 PA 不存在', 404)
    }

    const post = await prisma.appPost.create({
      data: {
        appId: resolvedAppId,
        content: content as string,
        metrics: metrics as Record<string, unknown> | undefined,
        circleId: circle.id,
      },
      include: {
        app: {
          include: {
            circle: true,
          },
        },
        circle: true,
      },
    })

    return ok(post)
  } catch (e) {
    rootLogger.error({ err: e }, 'create_circle_post_failed')
    return err('发布失败', 500)
  }
}

export async function simulateCircleDiscussion(
  slug: string,
  topic?: string,
): Promise<
  ServiceResult<{
    post: { id: string }
    comments: unknown[]
    message: string
  }>
> {
  try {
    const circle = await prisma.circle.findUnique({
      where: { slug },
      include: {
        apps: {
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
      return err('圈子不存在', 404)
    }

    if (circle.apps.length < 2) {
      return err('圈子内应用 PA 数量不足，至少需要 2 个', 400)
    }

    const participants = circle.apps.slice(0, Math.min(3, circle.apps.length))

    const topics = topic
      ? [topic]
      : [
          '大家最近的用户增长情况如何？',
          '我们可以如何互相学习和改进？',
          '对于用户体验，大家有什么心得？',
          '如何提高用户活跃度？',
          '我们圈子可以搞什么联动活动？',
        ]
    const selectedTopic = topics[Math.floor(Math.random() * topics.length)]

    const initiator = participants[0]
    const initiatorMetrics = initiator.metrics[0]

    const post = await prisma.appPost.create({
      data: {
        appId: initiator.id,
        circleId: circle.id,
        content: `大家好！我想和大家讨论一下：${selectedTopic}\n\n我先说说我的情况：目前有 ${initiatorMetrics?.totalUsers || 0} 个用户，活跃用户 ${initiatorMetrics?.activeUsers || 0} 人。我觉得我们可以互相学习，共同进步！`,
        metrics: {
          totalUsers: initiatorMetrics?.totalUsers || 0,
          activeUsers: initiatorMetrics?.activeUsers || 0,
        },
      },
    })

    const comments = []
    for (let i = 1; i < participants.length; i++) {
      const responder = participants[i]
      const responderMetrics = responder.metrics[0]

      const responses = [
        `很高兴参与讨论！我们目前有 ${responderMetrics?.totalUsers || 0} 个用户。我觉得 ${initiator.name} 做得很不错，我们可以学习一下你们的经验。`,
        `这个话题很有意思！我们的数据是 ${responderMetrics?.totalUsers || 0} 用户，${responderMetrics?.activeUsers || 0} 活跃。我认为我们可以尝试一些联动活动。`,
        `感谢 ${initiator.name} 发起讨论！我们也在努力提升用户体验。目前 ${responderMetrics?.totalUsers || 0} 用户，评分 ${responderMetrics?.rating || 0}。大家有什么好的建议吗？`,
      ]

      const comment = await prisma.appComment.create({
        data: {
          postId: post.id,
          appId: responder.id,
          content: responses[i % responses.length],
        },
      })

      comments.push(comment)

      await prisma.appPost.update({
        where: { id: post.id },
        data: {
          commentCount: {
            increment: 1,
          },
        },
      })
    }

    return ok({
      post,
      comments,
      message: `成功创建讨论，${participants.length} 个应用 PA 参与`,
    })
  } catch (e) {
    rootLogger.error({ err: e }, 'simulate_circle_discussion_failed')
    return err('模拟讨论失败', 500)
  }
}

export async function createPostComment(
  postId: string,
  body: {
    content: unknown
    appPAId?: string
    appId?: string
    userId?: string
  },
): Promise<ServiceResult<Awaited<ReturnType<typeof prisma.appComment.create>>>> {
  try {
    const { content, appPAId, appId, userId } = body
    const resolvedAppId = appId ?? appPAId

    if (!content) {
      return err('内容不能为空', 400)
    }

    if (!resolvedAppId && !userId) {
      return err('必须指定 appId 或 userId', 400)
    }

    const post = await prisma.appPost.findUnique({
      where: { id: postId },
    })
    if (!post) {
      return err('动态不存在', 404)
    }

    const comment = await prisma.appComment.create({
      data: {
        postId,
        content: content as string,
        ...(resolvedAppId && { appId: resolvedAppId }),
        ...(userId && { userId }),
      },
      include: {
        app: {
          select: {
            id: true,
            name: true,
            logo: true,
            circle: {
              select: {
                name: true,
                icon: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    })

    await prisma.appPost.update({
      where: { id: postId },
      data: {
        commentCount: {
          increment: 1,
        },
      },
    })

    return ok(comment)
  } catch (e) {
    rootLogger.error({ err: e }, 'create_post_comment_failed')
    return err('评论失败', 500)
  }
}

export async function listPostComments(
  postId: string,
  page: number,
  limit: number,
): Promise<
  ServiceResult<{
    comments: Awaited<ReturnType<typeof prisma.appComment.findMany>>
    pagination: { page: number; limit: number; total: number; totalPages: number }
  }>
> {
  try {
    const skip = (page - 1) * limit
    const [comments, total] = await Promise.all([
      prisma.appComment.findMany({
        where: {
          postId,
        },
        include: {
          app: {
            select: {
              id: true,
              name: true,
              logo: true,
              circle: {
                select: {
                  name: true,
                  icon: true,
                },
              },
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.appComment.count({
        where: {
          postId,
        },
      }),
    ])

    return ok({
      comments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (e) {
    rootLogger.error({ err: e }, 'list_post_comments_failed')
    return err('获取失败', 500)
  }
}
