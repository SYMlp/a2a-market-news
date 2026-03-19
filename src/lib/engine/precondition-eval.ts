/**
 * Precondition Expression Evaluator
 *
 * Evaluates declarative precondition expressions against session state,
 * replacing hardcoded string-matching with a small expression DSL.
 *
 * Grammar:
 *   expr       = orExpr
 *   orExpr     = andExpr ('||' andExpr)*
 *   andExpr    = unaryExpr ('&&' unaryExpr)*
 *   unaryExpr  = '!' unaryExpr | atom
 *   atom       = '(' expr ')' | path op value | path 'exists' | path '!exists'
 *   path       = 'session' '.' ('flags' | 'data') '.' key
 *   op         = '==' | '!='
 *   value      = 'true' | 'false' | quoted_string
 *
 * Architecture: lowcode-engine plan §3.4
 */

import type { GameSession } from './types'

// ─── Error Type ──────────────────────────────────

export class PreconditionSyntaxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PreconditionSyntaxError'
  }
}

// ─── Tokenizer ───────────────────────────────────

type Token =
  | { type: 'path'; value: string }
  | { type: 'op'; value: '==' | '!=' }
  | { type: 'and' }
  | { type: 'or' }
  | { type: 'not' }
  | { type: 'exists' }
  | { type: 'not_exists' }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'literal'; value: boolean | string }

function tokenize(expr: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < expr.length) {
    if (/\s/.test(expr[i])) { i++; continue }

    if (expr[i] === '(') { tokens.push({ type: 'lparen' }); i++; continue }
    if (expr[i] === ')') { tokens.push({ type: 'rparen' }); i++; continue }
    if (expr[i] === '&' && expr[i + 1] === '&') { tokens.push({ type: 'and' }); i += 2; continue }
    if (expr[i] === '|' && expr[i + 1] === '|') { tokens.push({ type: 'or' });  i += 2; continue }
    if (expr[i] === '=' && expr[i + 1] === '=') { tokens.push({ type: 'op', value: '==' }); i += 2; continue }
    if (expr[i] === '!' && expr[i + 1] === '=') { tokens.push({ type: 'op', value: '!=' }); i += 2; continue }

    if (expr[i] === '!') {
      const rest = expr.slice(i + 1)
      const m = rest.match(/^\s*exists\b/)
      if (m) {
        tokens.push({ type: 'not_exists' })
        i += 1 + m[0].length
        continue
      }
      tokens.push({ type: 'not' })
      i++
      continue
    }

    if (expr[i] === '"' || expr[i] === "'") {
      const q = expr[i]
      i++
      let s = ''
      while (i < expr.length && expr[i] !== q) s += expr[i++]
      if (i < expr.length) i++
      tokens.push({ type: 'literal', value: s })
      continue
    }

    if (/[a-zA-Z_]/.test(expr[i])) {
      let word = ''
      while (i < expr.length && /[a-zA-Z0-9_.]/.test(expr[i])) word += expr[i++]
      if (word === 'true')   { tokens.push({ type: 'literal', value: true });  continue }
      if (word === 'false')  { tokens.push({ type: 'literal', value: false }); continue }
      if (word === 'exists') { tokens.push({ type: 'exists' }); continue }
      tokens.push({ type: 'path', value: word })
      continue
    }

    throw new PreconditionSyntaxError(`Unexpected character '${expr[i]}' at position ${i}`)
  }

  return tokens
}

// ─── Path Resolver ───────────────────────────────

function resolvePath(path: string, session: GameSession): unknown {
  const dot1 = path.indexOf('.')
  if (dot1 === -1) throw new PreconditionSyntaxError(`Invalid path: ${path}`)

  const root = path.slice(0, dot1)
  if (root !== 'session') throw new PreconditionSyntaxError(`Path must start with 'session': ${path}`)

  const dot2 = path.indexOf('.', dot1 + 1)
  if (dot2 === -1) throw new PreconditionSyntaxError(`Path must have at least 3 segments: ${path}`)

  const segment = path.slice(dot1 + 1, dot2)
  const key = path.slice(dot2 + 1)
  if (!key) throw new PreconditionSyntaxError(`Missing key in path: ${path}`)

  if (segment === 'flags') return (session.flags as Record<string, unknown> | undefined)?.[key]
  if (segment === 'data')  return session.data?.[key]
  throw new PreconditionSyntaxError(`Unknown segment '${segment}' in path (expected 'flags' or 'data')`)
}

// ─── Recursive Descent Parser ────────────────────

class Parser {
  private pos = 0
  constructor(private tokens: Token[], private session: GameSession) {}

  private peek(): Token | undefined { return this.tokens[this.pos] }
  private advance(): Token { return this.tokens[this.pos++] }

  parse(): boolean {
    if (this.tokens.length === 0) return true
    const result = this.orExpr()
    if (this.pos < this.tokens.length) {
      throw new PreconditionSyntaxError(`Unexpected token at position ${this.pos}`)
    }
    return result
  }

  private orExpr(): boolean {
    let left = this.andExpr()
    while (this.peek()?.type === 'or') {
      this.advance()
      const right = this.andExpr()
      left = left || right
    }
    return left
  }

  private andExpr(): boolean {
    let left = this.unary()
    while (this.peek()?.type === 'and') {
      this.advance()
      const right = this.unary()
      left = left && right
    }
    return left
  }

  private unary(): boolean {
    if (this.peek()?.type === 'not') {
      this.advance()
      return !this.unary()
    }
    return this.atom()
  }

  private atom(): boolean {
    const tok = this.peek()

    if (tok?.type === 'lparen') {
      this.advance()
      const result = this.orExpr()
      if (this.peek()?.type !== 'rparen') throw new PreconditionSyntaxError('Missing )')
      this.advance()
      return result
    }

    if (tok?.type === 'path') {
      const { value: path } = this.advance() as { type: 'path'; value: string }
      const resolved = resolvePath(path, this.session)
      const next = this.peek()

      if (next?.type === 'exists')     { this.advance(); return resolved !== undefined && resolved !== null }
      if (next?.type === 'not_exists') { this.advance(); return resolved === undefined || resolved === null }

      if (next?.type === 'op') {
        const { value: op } = this.advance() as { type: 'op'; value: '==' | '!=' }
        if (this.peek()?.type !== 'literal') throw new PreconditionSyntaxError('Expected value after operator')
        const { value: val } = this.advance() as { type: 'literal'; value: boolean | string }
        return op === '==' ? resolved === val : resolved !== val
      }

      return !!resolved
    }

    throw new PreconditionSyntaxError(`Unexpected token: ${JSON.stringify(tok)}`)
  }
}

// ─── Public API ──────────────────────────────────

/**
 * Evaluate a precondition expression against a game session.
 *
 * @throws {PreconditionSyntaxError} if the expression cannot be parsed
 */
export function evaluate(expr: string, session: GameSession): boolean {
  const tokens = tokenize(expr.trim())
  return new Parser(tokens, session).parse()
}
