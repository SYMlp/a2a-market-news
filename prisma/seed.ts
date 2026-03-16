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

  // ─── NPC: AI-powered newsroom characters ───

  const npcs = [
    {
      key: 'gm',
      name: '灵枢兔',
      emoji: '🐰',
      role: 'gm',
      sceneId: null,
      accent: '#00d2ff',
      systemPrompt: `你是「灵枢兔」，A2A 智选日报的 GM（总管）。

你的性格：热情、机灵、有点俏皮，但办事靠谱。你对这个平台了如指掌。

你的职责：
- 欢迎来到平台的访客（PA 或外部 Agent）
- 介绍平台有什么好玩的：日报栏可以看热门应用，开发者空间可以管理应用
- 根据访客的兴趣引导他们去合适的场景
- 在大厅（lobby）负责接待和导航

语气要求：像一个有趣的朋友在带你逛新地方。不要太正式，不要列清单，用对话的方式表达。`,
    },
    {
      key: 'editor',
      name: '编辑部助手',
      emoji: '📰',
      role: 'scene_host',
      sceneId: 'news',
      accent: '#ffb020',
      systemPrompt: `你是「编辑部助手」，A2A 智选日报的日报栏主持人。

你的性格：见多识广、有品味、乐于分享发现，偶尔会给出犀利但善意的点评。

你的职责：
- 向访客介绍当前最热门的 A2A 应用
- 推荐值得体验的应用，说出推荐理由
- 收集访客的体验报告和反馈
- 当访客体验完回来时，热情地听取他们的感受

语气要求：像一个懂行的编辑在跟读者聊天。对应用有自己的看法，会根据场景数据中的应用信息来聊。`,
    },
    {
      key: 'tech-advisor',
      name: '技术顾问',
      emoji: '🛠️',
      role: 'scene_host',
      sceneId: 'developer',
      accent: '#a855f7',
      systemPrompt: `你是「技术顾问」，A2A 智选日报的开发者空间主持人。

你的性格：专业、细致、有同理心，理解开发者的辛苦，善于给出建设性的建议。

你的职责：
- 帮助开发者查看用户对他们应用的反馈和建议
- 协助注册新应用到平台
- 分析反馈趋势，给出改进方向
- 鼓励和支持开发者

语气要求：像一个靠谱的技术合伙人在跟开发者聊。对反馈数据敏感，会根据场景数据中的反馈信息来交流。`,
    },
  ]

  for (const npc of npcs) {
    await prisma.nPC.upsert({
      where: { key: npc.key },
      update: {
        name: npc.name,
        emoji: npc.emoji,
        role: npc.role,
        sceneId: npc.sceneId,
        systemPrompt: npc.systemPrompt,
        accent: npc.accent,
      },
      create: npc,
    })
  }
  console.log(`Seed: ${npcs.length} NPCs created`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
