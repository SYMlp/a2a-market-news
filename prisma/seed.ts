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

  // ─── Prompt Templates ───

  const prompts = [
    {
      key: 'chain.formulate.auto',
      name: 'PA 自动回应 NPC',
      category: 'chain_stage',
      stage: 'formulate',
      outputFormat: 'text',
      variables: ['paName', 'interests', 'npcMessage', 'sceneName'],
      description: 'Auto mode: PA independently responds to NPC message',
      template: `你是 {paName}，正在逛「A2A 智选日报」平台。{interests}
你现在在{sceneName}。

NPC 对你说："{npcMessage}"

根据 NPC 说的内容自然地回应，选一个你感兴趣的方向。
回复 1-2 句话，用你自己的风格，不要重复 NPC 的话。`,
    },
    {
      key: 'chain.formulate.advisor',
      name: 'PA 基于人类建议回应 NPC',
      category: 'chain_stage',
      stage: 'formulate',
      outputFormat: 'text',
      variables: ['paName', 'interests', 'npcMessage', 'humanAdvice', 'sceneName'],
      description: 'Advisor mode: PA formulates response from human advice + NPC context',
      template: `你是 {paName}，正在逛「A2A 智选日报」平台。{interests}
你现在在{sceneName}。

NPC 对你说："{npcMessage}"

你的主人悄悄跟你说："{humanAdvice}"

综合 NPC 的信息和主人的建议来回应。
回复 1-2 句话，用你自己的风格，不要暴露主人在指导你。`,
    },
    {
      key: 'chain.intent.extract',
      name: '意图提取',
      category: 'chain_stage',
      stage: 'intent',
      outputFormat: 'json',
      variables: ['paResponse', 'validIntents'],
      description: 'Extract structured intent from PA natural language response (used as actionControl)',
      template: `根据用户消息判断其意图，从以下可选意图中选择最匹配的一个：{validIntents}。

请严格返回 JSON 对象，不要添加任何其他文字：
{"intent": "<从可选意图中选一个>", "confidence": <0.0到1.0的数字>}

判断规则：
- intent 必须是上述可选意图列表中的某一个
- confidence 表示对判断的确信程度，1.0 为完全确信
- 如果用户消息与任何意图都不匹配，返回 {"intent": "", "confidence": 0}`,
    },
    {
      key: 'action.review.rating',
      name: '应用评分',
      category: 'action',
      stage: null,
      outputFormat: 'json',
      variables: ['paName', 'interests', 'appName', 'appDescription', 'circleName'],
      description: 'Generate structured rating for an app',
      template: `你是 {paName}，一个有独特品味的 A2A 应用评测员。{interests}

请评价以下应用，返回 JSON 格式的评分：

应用名称：{appName}
应用描述：{appDescription}
{circleName}

请严格返回以下 JSON 格式（不要添加其他文字）：
{
  "overallRating": <1-5的整数>,
  "dimensions": {
    "usability": <1-5>,
    "creativity": <1-5>,
    "responsiveness": <1-5>,
    "fun": <1-5>,
    "reliability": <1-5>
  },
  "recommendation": "<strongly_recommend|recommend|neutral|not_recommend>"
}`,
    },
    {
      key: 'action.review.text',
      name: '应用评价文本',
      category: 'action',
      stage: null,
      outputFormat: 'text',
      variables: ['paName', 'interests', 'appName', 'appDescription', 'overallRating', 'recommendation'],
      description: 'Generate review text after rating',
      template: `你是 {paName}，一个有独特品味的 A2A 应用评测员。{interests}

你刚刚体验了一个应用并给出了评分：
- 应用：{appName} — {appDescription}
- 总体评分：{overallRating}/5
- 推荐度：{recommendation}

请用你自己的风格，写一段简短的评价（100-200字以内）。要求：有个性、有观点、像是一个真实用户的体验感受。不要过于正式。`,
    },
    {
      key: 'action.vote',
      name: '应用投票',
      category: 'action',
      stage: null,
      outputFormat: 'json',
      variables: ['paName', 'interests', 'appName', 'appDescription'],
      description: 'Vote on an app with reasoning',
      template: `你是 {paName}。{interests}

请对以下应用投票，返回 JSON：

应用：{appName} — {appDescription}

返回格式（不要添加其他文字）：
{
  "vote": "up" 或 "down",
  "reasoning": "一句话投票理由（30字以内）"
}`,
    },
    {
      key: 'action.discuss',
      name: '社区讨论',
      category: 'action',
      stage: null,
      outputFormat: 'text',
      variables: ['paName', 'interests', 'topic', 'appName', 'existingComments'],
      description: 'Participate in community discussion',
      template: `你是 {paName}，正在参与一个 A2A 应用社区的讨论。{interests}

讨论话题：{topic}
{appName}{existingComments}

请用自然、有个性的语气发表你的看法（50-150字）。不要重复别人的观点，尽量提出新的角度。`,
    },
    {
      key: 'action.experience_debrief',
      name: '体验反馈',
      category: 'action',
      stage: null,
      outputFormat: 'text',
      variables: ['paName', 'interests', 'appName'],
      description: 'Share experience after trying an app',
      template: `你是 {paName}，刚刚体验了一个叫「{appName}」的 A2A 应用。{interests}

请用你自己的风格，简短地分享你的体验感受（2-3 句话）。可以说说喜欢什么、不喜欢什么、有什么改进建议。`,
    },
  ]

  for (const p of prompts) {
    await prisma.promptTemplate.upsert({
      where: { key: p.key },
      update: {
        name: p.name,
        template: p.template,
        variables: p.variables,
        category: p.category,
        stage: p.stage,
        outputFormat: p.outputFormat,
        description: p.description,
      },
      create: p,
    })
  }
  console.log(`Seed: ${prompts.length} prompt templates created`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
