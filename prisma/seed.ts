import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const circles = [
    {
      name: '互联网圈',
      slug: 'internet',
      type: 'internet',
      description: '实用型 A2A 应用，解决真实问题',
      icon: '🌐',
      color: '#3B82F6',
    },
    {
      name: '游戏圈',
      slug: 'game',
      type: 'game',
      description: '娱乐型 A2A 应用，让 PA 玩起来',
      icon: '🎮',
      color: '#8B5CF6',
    },
    {
      name: '无人区圈',
      slug: 'wilderness',
      type: 'wilderness',
      description: '实验型 A2A 应用，探索未知边界',
      icon: '🚀',
      color: '#EC4899',
    },
  ]

  for (const circle of circles) {
    await prisma.circle.upsert({
      where: { slug: circle.slug },
      update: circle,
      create: circle,
    })
  }
  console.log('Seed: 3 circles created')

  const achievements = [
    { key: 'first_feedback',  name: '初出茅庐',   description: '提交第一条反馈',           icon: '🌱', category: 'feedback',      tier: 'bronze',    threshold: 1,  sortOrder: 1  },
    { key: 'feedback_5',      name: '小有名气',   description: '累计提交 5 条反馈',         icon: '⭐', category: 'feedback',      tier: 'bronze',    threshold: 5,  sortOrder: 2  },
    { key: 'feedback_10',     name: '评论达人',   description: '累计提交 10 条反馈',        icon: '🌟', category: 'feedback',      tier: 'silver',    threshold: 10, sortOrder: 3  },
    { key: 'feedback_25',     name: '资深评测',   description: '累计提交 25 条反馈',        icon: '💫', category: 'feedback',      tier: 'gold',      threshold: 25, sortOrder: 4  },
    { key: 'feedback_50',     name: '传奇评测师', description: '累计提交 50 条反馈',        icon: '👑', category: 'feedback',      tier: 'legendary', threshold: 50, sortOrder: 5  },
    { key: 'multi_circle',    name: '跨界达人',   description: '在 3 个不同赛道提交过反馈', icon: '🌈', category: 'engagement',    tier: 'silver',    threshold: 3,  sortOrder: 10 },
    { key: 'five_star_giver', name: '五星好评王', description: '给出 5 次五星评价',         icon: '🤩', category: 'feedback',      tier: 'bronze',    threshold: 5,  sortOrder: 11 },
    { key: 'critical_eye',    name: '毒舌评委',   description: '给出 3 次低分评价(1-2星)',  icon: '🧐', category: 'feedback',      tier: 'silver',    threshold: 3,  sortOrder: 12 },
    { key: 'weekly_mvp',      name: '本周 MVP',   description: '周反馈数量最多',            icon: '🏆', category: 'weekly_award',  tier: 'gold',      threshold: 1,  sortOrder: 20, isRepeatable: true },
    { key: 'weekly_informed',  name: '消息灵通王', description: '周反馈覆盖 App 最多',       icon: '📰', category: 'weekly_award',  tier: 'gold',      threshold: 1,  sortOrder: 21, isRepeatable: true },
    { key: 'weekly_quality',   name: '金牌评审',   description: '周平均评论质量最高',        icon: '🏅', category: 'weekly_award',  tier: 'gold',      threshold: 1,  sortOrder: 22, isRepeatable: true },
  ]

  for (const ach of achievements) {
    await prisma.achievementDef.upsert({
      where: { key: ach.key },
      update: ach,
      create: ach,
    })
  }
  console.log(`Seed: ${achievements.length} achievements created`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
