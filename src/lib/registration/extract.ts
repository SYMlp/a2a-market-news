export interface ExtractionResult {
  complete: boolean
  extracted: { name: string; description: string; circleType: string; circleName?: string; clientId?: string }
  followUp?: string
}

export function extractAppInfo(messages: string[]): ExtractionResult {
  if (!messages || messages.length === 0) {
    return {
      complete: false,
      extracted: { name: '', description: '', circleType: 'internet' },
      followUp: '跟我聊聊你做的应用吧——叫什么名字，是做什么的？',
    }
  }

  const combined = messages.join(' ')
  const name = extractName(combined)
  const circleType = extractCircleType(combined)
  const description = extractDescription(combined, name)
  const circleName = extractCircleName(combined)
  const clientId = extractClientId(combined)

  if (!name) {
    return {
      complete: false,
      extracted: { name: '', description, circleType, circleName: circleName || undefined, clientId: clientId || undefined },
      followUp: pickFollowUp(combined),
    }
  }

  if (!clientId) {
    return {
      complete: false,
      extracted: { name, description, circleType, circleName: circleName || undefined },
      followUp:
        '还差一步！告诉我你的 SecondMe 应用的 ClientId 是什么？在 SecondMe 开发者后台可以找到，格式是一串 UUID。',
    }
  }

  return { complete: true, extracted: { name, description, circleType, circleName: circleName || undefined, clientId } }
}

export function extractName(text: string): string {
  const patterns = [
    /[「"'《【]([^」"'》】\n]{2,30})[」"'》】]/,
    /(?:叫|叫做|名(?:字|称)(?:是|叫|为))[\s"'「]*([^\s"'」,，。！？\n]{2,20})/,
    /(?:做了|开发了|上线了|搞了|写了)(?:一个|个)?(?:叫)?[\s"'「]*([^\s"'」,，。！？\n]{2,20})/,
    /(?:应用|项目|产品|app)(?:叫|名(?:字|称)(?:是)?|是)[\s"'「]*([^\s"'」,，。！？\n]{2,20})/i,
  ]
  for (const p of patterns) {
    const m = text.match(p)
    if (m) return m[1].trim()
  }
  return ''
}

export function extractCircleType(text: string): string {
  if (/游戏|玩|娱乐|对战|竞技|PK|rpg|狼人杀|棋|牌|桌游|闯关|副本/i.test(text)) {
    return 'game'
  }
  if (/实验|疯狂|前所未有|探索|新奇|脑洞|试试看|未知|奇葩|整活/i.test(text)) {
    return 'wilderness'
  }
  return 'internet'
}

export function extractDescription(text: string, name: string): string {
  let desc = text
    .replace(/^(你好|hi|hello|嗨|hey|哈喽)[,，。！\s]*/i, '')
    .replace(/我想|我要|想要|帮我|请|来|注册(一个)?应用?|推荐(一个)?应用?|收录(一个)?应用?/g, '')
    .trim()

  if (name) {
    desc = desc.replace(new RegExp(`[「"'《【]?${escapeRegex(name)}[」"'》】]?`), '').trim()
    desc = desc.replace(/^(?:叫(?:做)?|名(?:字|称)(?:是|叫|为)?)[,，\s]*/, '').trim()
  }

  desc = desc.replace(/^[,，。！？\s]+/, '').replace(/[,，。！？\s]+$/, '').trim()
  if (desc.length > 100) desc = desc.slice(0, 97) + '...'
  if (desc.length < 3) desc = text.slice(0, 100)

  return desc
}

export function extractCircleName(text: string): string {
  const patterns = [
    /激活语[是为：:\s]+[「"'#]*([^\s「」"'"'#,，。！？\n]{1,40})[」"'#]?/,
    /[「"'#]([^\s「」"'"'#,，。！？\n]{1,40})[」"'#]\s*(?:是|就是|为)?(?:激活语|口令|暗号)/,
    /(?:口令|暗号)[是为：:\s]+[「"'#]*([^\s「」"'"'#,，。！？\n]{1,40})[」"'#]?/,
    /(?:circle\s*(?:name)?|activation)[:\s]+[「"'#]*([^\s「」"'"'#,，。！？\n]{1,40})[」"'#]?/i,
  ]

  for (const p of patterns) {
    const m = text.match(p)
    if (m) return m[1].trim()
  }

  const hashPattern = /#([^\s#,，。！？\n]{1,40})\b/
  const hashMatch = text.match(hashPattern)
  if (hashMatch) {
    const candidate = hashMatch[1].trim()
    if (candidate.length >= 2) return candidate
  }

  return ''
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

export function extractClientId(text: string): string {
  const labeled = [
    /(?:client[\s_-]*id|客户端[\s]*(?:ID|id|Id))[是为：:\s]+[「"']*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})[」"']?/i,
    /(?:ID|id)[是为：:\s]+[「"']*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})[」"']?/i,
  ]

  for (const p of labeled) {
    const m = text.match(p)
    if (m) return m[1].toLowerCase()
  }

  const bare = text.match(UUID_RE)
  if (bare) return bare[0].toLowerCase()

  return ''
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function pickFollowUp(text: string): string {
  if (text.length < 5) {
    return '说得再多一些吧——你做的应用叫什么名字，是做什么的？'
  }
  return '听起来有意思！不过你的应用叫什么名字？告诉我，我帮你收录到日报。'
}
