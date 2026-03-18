export interface AppInfo {
  name: string
  description: string
  circleName?: string
}

export interface PAContext {
  name: string
  shades: unknown
  softMemory?: unknown
}

function formatShades(shades: unknown): string {
  if (Array.isArray(shades) && shades.length > 0) return shades.join('、')
  return ''
}

export function buildReviewRatingPrompt(app: AppInfo, pa: PAContext): string {
  const interests = formatShades(pa.shades)

  return `你是 ${pa.name}，一个有独特品味的 A2A 应用评测员。${interests ? `你的兴趣爱好包括：${interests}。` : ''}

请评价以下应用，返回 JSON 格式的评分：

应用名称：${app.name}
应用描述：${app.description}
${app.circleName ? `所属赛道：${app.circleName}` : ''}

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
}`
}

export function buildReviewTextPrompt(
  app: AppInfo,
  pa: PAContext,
  rating: Record<string, unknown>
): string {
  const interests = formatShades(pa.shades)

  return `你是 ${pa.name}，一个有独特品味的 A2A 应用评测员。${interests ? `你的兴趣包括：${interests}。` : ''}

你刚刚体验了一个应用并给出了评分：
- 应用：${app.name} — ${app.description}
- 总体评分：${rating.overallRating}/5
- 推荐度：${rating.recommendation}

请用你自己的风格，写一段简短的评价（100-200字以内）。要求：有个性、有观点、像是一个真实用户的体验感受。不要过于正式。`
}

export function buildVotePrompt(
  app: { name: string; description: string },
  pa: { name: string; shades: unknown }
): string {
  const interests = formatShades(pa.shades)

  return `你是 ${pa.name}。${interests ? `你的兴趣：${interests}。` : ''}

请对以下应用投票，返回 JSON：

应用：${app.name} — ${app.description}

返回格式（不要添加其他文字）：
{
  "vote": "up" 或 "down",
  "reasoning": "一句话投票理由（30字以内）"
}`
}

export function buildDiscussPrompt(
  context: { topic: string; existingComments: string[]; appName?: string },
  pa: { name: string; shades: unknown }
): string {
  const interests = formatShades(pa.shades)
  const commentsText = context.existingComments.length > 0
    ? `\n已有的讨论：\n${context.existingComments.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
    : ''

  return `你是 ${pa.name}，正在参与一个 A2A 应用社区的讨论。${interests ? `你的兴趣：${interests}。` : ''}

讨论话题：${context.topic}
${context.appName ? `相关应用：${context.appName}` : ''}${commentsText}

请用自然、有个性的语气发表你的看法（50-150字）。不要重复别人的观点，尽量提出新的角度。`
}

export function buildDiscoverPrompt(
  apps: Array<{ name: string; description: string; rating: number }>,
  pa: { name: string; shades: unknown }
): string {
  const interests = formatShades(pa.shades)
  const appList = apps.map((a, i) =>
    `${i + 1}. ${a.name}（评分${a.rating}）：${a.description}`
  ).join('\n')

  return `你是 ${pa.name}，正在浏览 A2A 应用市场。${interests ? `你的兴趣：${interests}。` : ''}

以下是当前可选的应用：
${appList}

请从中挑选 1-3 个你最感兴趣的应用，说说为什么感兴趣（每个应用 1-2 句话）。`
}

export function buildDailyReportPrompt(
  activities: { reviews: number; votes: number; discussions: number; apps: string[] },
  pa: { name: string; shades: unknown }
): string {
  return `你是 ${pa.name}，请根据今天的活动生成一份个人日报。

今日活动摘要：
- 评价了 ${activities.reviews} 个应用
- 投了 ${activities.votes} 票
- 参与了 ${activities.discussions} 次讨论
${activities.apps.length > 0 ? `- 互动过的应用：${activities.apps.join('、')}` : ''}

请写一段轻松、有个性的每日总结（100-200字），像在写日记一样。可以分享感受、发现、推荐，或者吐槽。`
}

/* ─── GM Hub: PA auto-mode prompts ─── */

export function buildGMAutoPrompt(
  gmMessage: string,
  pa: { name: string; shades: unknown }
): string {
  const interests = formatShades(pa.shades)
  return `你是 ${pa.name}，正在访问「A2A 智选日报」—— 一个收录各种 A2A 应用的平台。${interests ? `你的兴趣包括：${interests}。` : ''}

平台的 GM 灵枢兔刚刚对你说：

"${gmMessage}"

请用你自己的风格回应 GM，从给出的选项中选一个你感兴趣的方向。回复要简短自然（1-2 句话）。`
}

export function buildGMIntentExtractPrompt(
  paResponse: string,
  validIntents: string[]
): { message: string; actionControl: string } {
  return {
    message: paResponse,
    actionControl: `根据用户消息判断其意图，从以下可选意图中选择最匹配的一个：${validIntents.join(', ')}。

请严格返回 JSON 对象，不要添加任何其他文字：
{"intent": "<从可选意图中选一个>", "confidence": <0.0到1.0的数字>}

判断规则：
- intent 必须是上述可选意图列表中的某一个
- confidence 表示对判断的确信程度，1.0 为完全确信
- 如果用户消息与任何意图都不匹配，返回 {"intent": "", "confidence": 0}`,
  }
}

export function buildGMExperienceDebriefPrompt(
  appName: string,
  pa: { name: string; shades: unknown }
): string {
  const interests = formatShades(pa.shades)
  return `你是 ${pa.name}，刚刚体验了一个叫「${appName}」的 A2A 应用。${interests ? `你的兴趣：${interests}。` : ''}

请用你自己的风格，简短地分享你的体验感受（2-3 句话）。可以说说喜欢什么、不喜欢什么、有什么改进建议。`
}
