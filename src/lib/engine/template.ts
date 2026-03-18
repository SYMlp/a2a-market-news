import type { DualText } from './types'

export function fillTemplate(
  text: DualText,
  data?: Record<string, unknown>,
): DualText {
  if (!data) return text
  return {
    pa: replaceVars(text.pa, data),
    agent: replaceVars(text.agent, data),
  }
}

export function replaceVars(s: string, data: Record<string, unknown>): string {
  return s.replace(/\{(\w+)\}/g, (match, key) => {
    const val = data[key]
    if (val === undefined || val === null) return ''
    if (typeof val === 'string') return val
    return JSON.stringify(val)
  })
}
