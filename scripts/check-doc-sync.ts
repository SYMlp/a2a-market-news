import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

type MappingRow = {
  codePattern: string
  docPath: string
}

const PROJECT_ROOT = process.cwd()
const RULE_PATH = join(PROJECT_ROOT, '.cursor', 'rules', 'design-code-sync.mdc')

function runGit(args: string[]): string {
  const result = spawnSync('git', args, {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    return ''
  }
  return result.stdout.trim()
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\/+/, '')
}

function extractBacktickPath(cell: string): string | null {
  const matches = [...cell.matchAll(/`([^`]+)`/g)].map(m => m[1].trim())
  for (const m of matches) {
    if (m.includes('/')) return normalizePath(m)
  }
  return null
}

function parseDependencyMap(markdown: string): MappingRow[] {
  const lines = markdown.split('\n')
  const start = lines.findIndex(line => line.trim() === '## Dependency Map')
  const end = lines.findIndex((line, idx) => idx > start && line.trim() === '## Behavior')
  if (start === -1 || end === -1 || end <= start) {
    return []
  }

  const rows: MappingRow[] = []
  for (const line of lines.slice(start + 1, end)) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('|')) continue
    if (trimmed.includes('| :---')) continue

    const cells = trimmed.split('|').map(c => c.trim()).filter(Boolean)
    if (cells.length < 3) continue

    const codePath = extractBacktickPath(cells[0])
    const docPath = extractBacktickPath(cells[1])
    if (!codePath || !docPath) continue

    rows.push({ codePattern: codePath, docPath })
  }

  return rows
}

function globToRegex(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLE_STAR::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DOUBLE_STAR::/g, '.*')
  return new RegExp(`^${escaped}$`)
}

function getChangedFiles(): string[] {
  const base = process.env.DOC_SYNC_BASE?.trim()
  let raw = ''

  if (base) {
    raw = runGit(['diff', '--name-only', `${base}...HEAD`])
  }
  if (!raw) {
    raw = runGit(['show', '--pretty=', '--name-only', 'HEAD'])
  }
  if (!raw) {
    raw = runGit(['status', '--porcelain'])
    if (raw) {
      return Array.from(
        new Set(
          raw
            .split('\n')
            .map(line => line.slice(3).trim())
            .filter(Boolean)
            .map(normalizePath),
        ),
      )
    }
  }

  return Array.from(
    new Set(
      raw
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(normalizePath),
    ),
  )
}

function main(): void {
  const rule = readFileSync(RULE_PATH, 'utf8')
  const mappings = parseDependencyMap(rule)
  if (mappings.length === 0) {
    console.log('[doc-sync] no mappings parsed from design-code-sync.mdc; skipping')
    return
  }

  const changed = getChangedFiles()
  if (changed.length === 0) {
    console.log('[doc-sync] no changed files detected; skipping')
    return
  }

  const triggered = mappings.filter(map => {
    const regex = globToRegex(map.codePattern)
    return changed.some(file => regex.test(file))
  })

  if (triggered.length === 0) {
    console.log('[doc-sync] no mapped code files changed; pass')
    return
  }

  const docsChanged = new Set(changed)
  const requiredDocs = Array.from(new Set(triggered.map(t => t.docPath)))
  const missingDocs = requiredDocs.filter(doc => !docsChanged.has(doc))

  if (missingDocs.length === 0) {
    console.log('[doc-sync] pass: mapped code changes include doc/rule updates')
    return
  }

  console.error('[doc-sync] failed: mapped code changed without synced docs/rules')
  console.error('')
  console.error('Changed mapped code:')
  for (const item of triggered) {
    console.error(`- ${item.codePattern}`)
  }
  console.error('')
  console.error('Expected changed docs/rules:')
  for (const doc of requiredDocs) {
    const mark = missingDocs.includes(doc) ? 'missing' : 'ok'
    console.error(`- [${mark}] ${doc}`)
  }
  console.error('')
  console.error('If this was intentional, update the mapped docs/rules or set DOC_SYNC_BASE explicitly.')
  process.exit(1)
}

main()
