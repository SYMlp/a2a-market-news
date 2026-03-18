export interface ExtractionResult {
  complete: boolean
  extracted: { name: string; description: string; circleType: string }
  followUp?: string
}

export function extractAppInfo(messages: string[]): ExtractionResult {
  if (!messages || messages.length === 0) {
    return {
      complete: false,
      extracted: { name: '', description: '', circleType: 'internet' },
      followUp: '跟我聊聊你的应用吧——叫什么名字，是做什么的？',
    }
  }

  const combined = messages.join(' ')
  const name = extractName(combined)
  const circleType = extractCircleType(combined)
  const description = extractDescription(combined, name)

  if (!name) {
    return {
      complete: false,
      extracted: { name: '', description, circleType },
      followUp: pickFollowUp(combined),
    }
  }

  return { complete: true, extracted: { name, description, circleType } }
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
    .replace(/我想|我要|想要|帮我|请|来|注册(一个)?应用?/g, '')
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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function pickFollowUp(text: string): string {
  if (text.length < 5) {
    return '说得再多一些吧——你的应用叫什么名字，是做什么的？'
  }
  return '听起来有意思！不过你的应用叫什么名字？给它取个响亮的名字吧！'
}
