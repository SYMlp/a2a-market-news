/**
 * Architecture Layer Boundary Tests
 *
 * Enforces the 4-layer system model (L0–L3) defined in
 * docs/system-architecture-overview.md. Key invariant:
 *
 *   L3 (Turn-Level Game Loop) must NOT directly call L0 (Persistence).
 *
 * Layer assignment:
 *   L0  — prisma, database writes, session creation at HTTP level
 *   L1  — GM scene graph, scene routing
 *   L2  — PA lifecycle per scene
 *   L3  — src/lib/engine/* (game loop, classifier, guard, match, template…)
 *
 * Session persistence is in-memory only (invariant from engine-invariants.md).
 * The only sanctioned persistence bridge is event-logger.ts (logging infra)
 * which is called from route handlers, not from engine core.
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// ─── Helpers ──────────────────────────────────────────

const ENGINE_DIR = path.resolve(__dirname, '../../lib/engine')

function extractImportPaths(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const results: string[] = []

  const staticImport =
    /import\s+(?:type\s+)?(?:\{[^}]*\}|[\w*]+(?:\s+as\s+\w+)?(?:\s*,\s*\{[^}]*\})?)\s+from\s+['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = staticImport.exec(content)) !== null) {
    results.push(m[1])
  }

  const dynamicImport = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  while ((m = dynamicImport.exec(content)) !== null) {
    results.push(m[1])
  }

  return results
}

function getFilesRecursive(dir: string, ext = '.ts'): string[] {
  if (!fs.existsSync(dir)) return []
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...getFilesRecursive(full, ext))
    } else if (entry.name.endsWith(ext) && !entry.name.endsWith('.test.ts')) {
      out.push(full)
    }
  }
  return out
}

function rel(filePath: string): string {
  return path.relative(path.resolve(__dirname, '../../..'), filePath).replace(/\\/g, '/')
}

// ─── Layer definitions ────────────────────────────────

const PERSISTENCE_MODULES = ['@/lib/prisma', '@prisma/client']

/**
 * Engine core files whose sole concern is the turn-level game loop (L3).
 * These must never reach down to L0 persistence.
 *
 * event-logger.ts is excluded — it's logging infrastructure that bridges
 * engine events to the DB. It's called from route handlers (L0 boundary),
 * not from within the game loop.
 */
const L3_CORE_FILES = [
  'game-loop.ts',
  'conversation-guard.ts',
  'ai-classifier.ts',
  'match.ts',
  'template.ts',
  'precondition-eval.ts',
  'ontology.ts',
  'session.ts',
  'scene-loader.ts',
  'session-context.ts',
  'types.ts',
  'index.ts',
]

/**
 * Known L3→L0 violations. Empty after P3-3 moved fc-dispatcher's Prisma
 * queries to handler-registry effect handlers. The violation count test
 * will fail if new violations appear without being registered.
 */
const KNOWN_L0_VIOLATIONS: Record<string, string[]> = {}

/**
 * Known route-layer violations for direct session persistence import.
 * Routes should use session-context.ts or the GM facade, not import
 * persistSession from engine/session directly.
 * As P0-1 fixes them, remove entries here.
 */
const KNOWN_ROUTE_PERSIST_VIOLATIONS: string[] = []

// ═══════════════════════════════════════════════════════
// Test suites
// ═══════════════════════════════════════════════════════

describe('Layer Boundary — L3 Engine Core → L0 Persistence Isolation', () => {
  for (const file of L3_CORE_FILES) {
    it(`${file} must not import persistence modules`, () => {
      const filePath = path.join(ENGINE_DIR, file)
      if (!fs.existsSync(filePath)) return

      const imports = extractImportPaths(filePath)
      const violations = imports.filter(imp =>
        PERSISTENCE_MODULES.some(mod => imp === mod || imp.startsWith(mod + '/')),
      )

      expect(
        violations,
        `${file} violates L3→L0 boundary by importing: ${violations.join(', ')}`,
      ).toEqual([])
    })
  }

  it('known violations list is exhaustive (no untracked L0 imports in engine/)', () => {
    const allEngineFiles = getFilesRecursive(ENGINE_DIR)
    const unexpected: string[] = []

    for (const filePath of allEngineFiles) {
      const basename = path.basename(filePath)
      if (basename === 'event-logger.ts') continue

      const imports = extractImportPaths(filePath)
      const persistenceImports = imports.filter(imp =>
        PERSISTENCE_MODULES.some(mod => imp === mod || imp.startsWith(mod + '/')),
      )

      if (persistenceImports.length === 0) continue

      const known = KNOWN_L0_VIOLATIONS[basename] ?? []
      const untracked = persistenceImports.filter(imp => !known.includes(imp))
      if (untracked.length > 0) {
        unexpected.push(`${basename}: ${untracked.join(', ')}`)
      }
    }

    expect(
      unexpected,
      'New L3→L0 violations found. Either fix the import or add to KNOWN_L0_VIOLATIONS with a tracking issue.',
    ).toEqual([])
  })

  it('known violation count must not increase', () => {
    const totalKnown = Object.values(KNOWN_L0_VIOLATIONS).reduce(
      (sum, arr) => sum + arr.length,
      0,
    )
    expect(totalKnown).toBeLessThanOrEqual(0)
  })
})

describe('Layer Boundary — Session Persistence Centralization', () => {
  it('only session-context.ts may import persistSession from ./session', () => {
    const engineFiles = getFilesRecursive(ENGINE_DIR)
    const violations: string[] = []

    for (const filePath of engineFiles) {
      const basename = path.basename(filePath)
      if (basename === 'session-context.ts') continue
      if (basename === 'session.ts') continue

      const content = fs.readFileSync(filePath, 'utf-8')
      if (/import\s+[^;]*\bpersistSession\b[^;]*from\s+['"]\.\/session['"]/.test(content)) {
        violations.push(basename)
      }
    }

    expect(
      violations,
      `Files importing persistSession directly (must go through session-context.ts): ${violations.join(', ')}`,
    ).toEqual([])
  })

  it('route files must not import persistSession from engine/session (new violations)', () => {
    const routeDir = path.resolve(__dirname, '../../app/api')
    const routeFiles = getFilesRecursive(routeDir)
    const newViolations: string[] = []

    for (const filePath of routeFiles) {
      const content = fs.readFileSync(filePath, 'utf-8')
      const lines = content.split('\n')

      for (const line of lines) {
        if (
          /\bpersistSession\b/.test(line)
          && /from\s+['"]@\/lib\/engine\/session['"]/.test(line)
        ) {
          const relPath = rel(filePath)
          if (!KNOWN_ROUTE_PERSIST_VIOLATIONS.includes(relPath)) {
            newViolations.push(relPath)
          }
          break
        }
      }
    }

    expect(
      newViolations,
      `New route files importing persistSession directly. Fix or add to KNOWN_ROUTE_PERSIST_VIOLATIONS: ${newViolations.join(', ')}`,
    ).toEqual([])
  })

  it('known route persist violations must not increase', () => {
    expect(KNOWN_ROUTE_PERSIST_VIOLATIONS.length).toBeLessThanOrEqual(0)
  })
})

describe('Layer Boundary — Engine Event Logger Isolation', () => {
  it('event-logger.ts must only be imported from route handlers, not engine core', () => {
    const engineFiles = getFilesRecursive(ENGINE_DIR)
    const violations: string[] = []

    for (const filePath of engineFiles) {
      const basename = path.basename(filePath)
      if (basename === 'event-logger.ts') continue
      if (basename === 'index.ts') continue

      const imports = extractImportPaths(filePath)
      const loggerImports = imports.filter(
        imp => imp === './event-logger' || imp === '../engine/event-logger',
      )

      if (loggerImports.length > 0) {
        violations.push(basename)
      }
    }

    expect(
      violations,
      `Engine core files must not import event-logger (DB bridge). Call it from route handlers instead: ${violations.join(', ')}`,
    ).toEqual([])
  })
})

describe('Layer Boundary — MessageEnvelope API Boundary', () => {
  it('engine core files must not call toEnvelope()', () => {
    const violations: string[] = []

    for (const file of L3_CORE_FILES) {
      const filePath = path.join(ENGINE_DIR, file)
      if (!fs.existsSync(filePath)) continue
      if (file === 'ontology.ts') continue

      const content = fs.readFileSync(filePath, 'utf-8')
      const lines = content.split('\n')
      const codeLines = lines.filter(l => {
        const trimmed = l.trim()
        return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/**')
      })
      if (codeLines.some(l => /\btoEnvelope\s*\(/.test(l))) {
        violations.push(file)
      }
    }

    expect(
      violations,
      `toEnvelope() must only be called at API boundaries (route handlers), not in engine core: ${violations.join(', ')}`,
    ).toEqual([])
  })
})

describe('Layer Boundary — External Session Persistence Isolation', () => {
  /**
   * Non-engine lib files should use persistSessionState from session-context,
   * not import persistSession directly from engine/session.
   * Tracked violations will be resolved by P3-1/P3-2 (SubFlow persistence bridge).
   */
  const KNOWN_EXTERNAL_PERSIST_VIOLATIONS: string[] = []

  it('non-engine libs must not import persistSession from engine/session (new violations)', () => {
    const libDir = path.resolve(__dirname, '../../lib')
    const allLibFiles = getFilesRecursive(libDir)
    const newViolations: string[] = []

    for (const filePath of allLibFiles) {
      if (filePath.replace(/\\/g, '/').includes('/lib/engine/')) continue

      const content = fs.readFileSync(filePath, 'utf-8')
      if (/import\s+[^;]*\bpersistSession\b[^;]*from\s+['"]@\/lib\/engine\/session['"]/.test(content)) {
        const relPath = rel(filePath)
        if (!KNOWN_EXTERNAL_PERSIST_VIOLATIONS.includes(relPath)) {
          newViolations.push(relPath)
        }
      }
    }

    expect(
      newViolations,
      `Non-engine files importing persistSession directly. Use persistSessionState from session-context: ${newViolations.join(', ')}`,
    ).toEqual([])
  })

  it('known external persist violations must not increase', () => {
    expect(KNOWN_EXTERNAL_PERSIST_VIOLATIONS.length).toBeLessThanOrEqual(0)
  })
})

describe('Layer Boundary — Spec-Driven Data Loading', () => {
  it('engine core files must not import scene definitions from hardcoded TS modules', () => {
    const bannedImportPatterns = [
      /from\s+['"].*\/scenes\/lobby['"]/,
      /from\s+['"].*\/scenes\/news['"]/,
      /from\s+['"].*\/scenes\/developer['"]/,
    ]

    const violations: string[] = []

    for (const file of L3_CORE_FILES) {
      if (file === 'types.ts' || file === 'index.ts') continue
      const filePath = path.join(ENGINE_DIR, file)
      if (!fs.existsSync(filePath)) continue

      const content = fs.readFileSync(filePath, 'utf-8')
      for (const pattern of bannedImportPatterns) {
        if (pattern.test(content)) {
          violations.push(`${file} imports hardcoded scene module`)
          break
        }
      }
    }

    expect(
      violations,
      `Engine files must load scenes from specs/scenes/*.yaml via scene-loader, not from hardcoded TS modules: ${violations.join(', ')}`,
    ).toEqual([])
  })
})
