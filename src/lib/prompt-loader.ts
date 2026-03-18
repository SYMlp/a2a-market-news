import { prisma } from './prisma'

const cache = new Map<string, { template: string; ts: number }>()
const CACHE_TTL = 5 * 60 * 1000

/**
 * Load a prompt template by key, inject variables, return formatted string.
 * Falls back to `fallback` if DB entry is missing or inactive.
 */
export async function loadPrompt(
  key: string,
  vars: Record<string, string>,
  fallback?: string,
): Promise<string> {
  let template = fallback ?? ''

  try {
    const cached = cache.get(key)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      template = cached.template
    } else {
      const row = await prisma.promptTemplate.findUnique({ where: { key } })
      if (row?.isActive) {
        template = row.template
        cache.set(key, { template, ts: Date.now() })
      }
    }
  } catch {
    // DB unavailable — use fallback silently
  }

  return injectVars(template, vars)
}

/**
 * Load a prompt that returns { message, actionControl } for the act API.
 * The template is used as actionControl; `message` comes from vars.paResponse.
 */
export async function loadActPrompt(
  key: string,
  vars: Record<string, string>,
  fallback?: string,
): Promise<{ message: string; actionControl: string }> {
  const actionControl = await loadPrompt(key, vars, fallback)
  return { message: vars.paResponse ?? '', actionControl }
}

function injectVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? '')
}

export function invalidatePromptCache(key?: string): void {
  if (key) cache.delete(key)
  else cache.clear()
}
