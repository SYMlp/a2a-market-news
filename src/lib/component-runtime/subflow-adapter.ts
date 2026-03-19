/**
 * SubFlow adapter — generates SubFlowHandler from ComponentSpec.
 * Core bridge: spec.collect/actions/lifecycle → handleMessage + handleConfirm.
 *
 * Three collect strategies, selected by spec structure:
 *   1. App-oriented  (dataSource present)          → app-settings, app-lifecycle
 *   2. Regex-driven  (collect.extractFromMessage)   → profile
 *   3. Effect-driven (collect.extract + transitions) → register
 *
 * Architecture: docs/component-spec-architecture.md (P7-1)
 * ADR-5: string-referenced effect pattern (handler-registry.ts)
 */

import { NextResponse } from 'next/server'
import { persistSession } from '@/lib/engine/session'
import type { GameSession, SubFlowState, SubFlowType } from '@/lib/engine/types'
import type { SubFlowHandler } from '@/lib/subflow/router'
import type { Collect, ComponentSpec, MessageTemplate } from './types'
import { invokeEffect, EffectError, type EffectContext } from './handler-registry'

// ─── Public API ──────────────────────────────────

export function createSubFlowHandler(spec: ComponentSpec): SubFlowHandler {
  return {
    type: spec.id as SubFlowType,
    handleMessage: (session, message, user) =>
      dispatchMessage(spec, session, message, user),
    handleConfirm: (session, args, user) =>
      executeConfirm(spec, session, args, user),
  }
}

// ─── Internal types ──────────────────────────────

interface AppInfo {
  id: string
  name: string
  description?: string | null
  website?: string | null
  clientId: string | null
  status?: string
  [key: string]: unknown
}

// ─── Response helpers ────────────────────────────

function dual(t: MessageTemplate): { pa: string; agent: string } {
  return typeof t === 'string' ? { pa: t, agent: t } : t
}

function respond(
  session: GameSession,
  msg: { pa: string; agent: string },
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json({
    success: true,
    message: msg,
    currentScene: session.currentScene,
    sessionId: session.id,
    ...extra,
  })
}

function respondError(error: string, status = 400): NextResponse {
  return NextResponse.json({ success: false, error }, { status })
}

function interpolate(tpl: string, vars: Record<string, unknown>): string {
  return tpl.replace(/\$\{([^}]+)\}/g, (_, key) => {
    const v = vars[key.trim()]
    return v != null ? String(v) : ''
  })
}

function interpMsg(
  msg: { pa: string; agent: string },
  vars: Record<string, unknown>,
): { pa: string; agent: string } {
  return { pa: interpolate(msg.pa, vars), agent: interpolate(msg.agent, vars) }
}

// ─── Condition evaluator ─────────────────────────

/**
 * Evaluate a simple boolean condition against a flat variable map.
 *
 * Grammar (deliberately minimal — covers all ComponentSpec `when` patterns):
 *   expr     = conjunct ('&&' conjunct)*
 *   conjunct = '!' atom | atom
 *   atom     = FIELD '.nonEmpty'    →  Object.keys(vars[FIELD]).length > 0
 *            | FIELD               →  !!vars[FIELD]
 */
function evaluateCondition(expr: string, vars: Record<string, unknown>): boolean {
  if (expr.includes('&&')) {
    return expr.split('&&').map(s => s.trim()).every(sub => evaluateCondition(sub, vars))
  }

  const term = expr.trim()
  if (!term) return false

  if (term.startsWith('!')) {
    return !evaluateCondition(term.slice(1), vars)
  }

  if (term.endsWith('.nonEmpty')) {
    const field = term.slice(0, -'.nonEmpty'.length)
    const val = vars[field]
    return !!val && typeof val === 'object' && Object.keys(val as Record<string, unknown>).length > 0
  }

  return !!vars[term]
}

// ─── Data helpers ────────────────────────────────

const CN_INDEX: Record<string, number> = {
  '一': 0, '二': 1, '三': 2, '四': 3, '五': 4,
  '1': 0, '2': 1, '3': 2, '4': 3, '5': 4,
}

function loadApps(session: GameSession, spec: ComponentSpec): AppInfo[] {
  const subFlow = session.flags?.subFlow as SubFlowState | undefined

  if (spec.dataSource?.fallback === 'subFlow.context.userApps') {
    const ctx = (subFlow?.context ?? {}) as Record<string, unknown>
    const apps = ctx.userApps as AppInfo[] | undefined
    if (apps?.length) return filterApps(apps, spec)
  }

  const raw = session.data?.apps_json
  if (typeof raw !== 'string') return []
  try {
    const arr = JSON.parse(raw) as AppInfo[]
    return filterApps(Array.isArray(arr) ? arr : [], spec)
  } catch {
    return []
  }
}

function filterApps(apps: AppInfo[], spec: ComponentSpec): AppInfo[] {
  if (spec.dataSource?.filter === "status !== 'archived'") {
    return apps.filter(a => a.status !== 'archived')
  }
  return apps
}

function matchApp(message: string, apps: AppInfo[]): AppInfo | null {
  if (!apps.length) return null
  const m = message.match(/第?([一二三四五1-5])[个号]?/)
  if (m) {
    const idx = CN_INDEX[m[1]]
    if (idx !== undefined && idx < apps.length) return apps[idx]
  }
  for (const app of apps) {
    if (message.includes(app.name)) return app
  }
  return null
}

// ─── Regex extraction ────────────────────────────

function applyRegexPatterns(
  message: string,
  patterns: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [field, raw] of Object.entries(patterns)) {
    const m = raw.match(/^\/(.+)\/([gimsuy]*)$/)
    if (!m) continue
    try {
      const hit = message.match(new RegExp(m[1], m[2]))
      if (hit?.[1]) result[field] = hit[1].trim()
    } catch { /* invalid regex — skip */ }
  }
  return result
}

function applyPreferenceMapping(
  values: Record<string, string>,
  mapping: Record<string, string>,
): void {
  for (const [key, val] of Object.entries(values)) {
    const mapped = mapping[val] ?? mapping[val.toLowerCase()]
    if (mapped) values[key] = mapped
  }
}

// ─── Status intent extraction ────────────────────

function matchStatusIntent(
  message: string,
  config: Record<string, string>,
): string | null {
  for (const [status, raw] of Object.entries(config)) {
    const m = raw.match(/^\/(.+)\/([gimsuy]*)$/)
    if (!m) continue
    try {
      if (new RegExp(m[1], m[2]).test(message)) return status
    } catch { /* skip */ }
  }
  return null
}

// ─── Transition-readiness check ──────────────────

function isReadyForConfirm(
  spec: ComponentSpec,
  context: Record<string, unknown>,
): boolean {
  const when = spec.collect?.transitionToConfirm?.when
  if (!when) return false
  return evaluateCondition(when, context)
}

// ─── Extracted data builder ──────────────────────

function buildExtracted(
  spec: ComponentSpec,
  context: Record<string, unknown>,
  app?: AppInfo | null,
): Record<string, unknown> {
  const extracted: Record<string, unknown> = {}
  const params = spec.actions.confirm.params

  for (const [key, schema] of Object.entries(params)) {
    if (schema.type === 'object' && schema.properties && app) {
      const obj: Record<string, unknown> = {}
      for (const propKey of Object.keys(schema.properties)) {
        if (app[propKey]) obj[propKey] = app[propKey]
      }
      extracted[key] = obj
    } else if (context[key] !== undefined) {
      extracted[key] = context[key]
    }
  }

  return extracted
}

// ─── Card presentation ──────────────────────────

function showCard(
  session: GameSession,
  subFlow: SubFlowState,
  spec: ComponentSpec,
  extracted: Record<string, unknown>,
  msg?: { pa: string; agent: string },
): NextResponse {
  subFlow.step = 'confirm'
  subFlow.extracted = extracted
  persistSession(session)

  return respond(
    session,
    msg ?? { pa: '收到！确认一下——', agent: `Presenting ${spec.id} card.` },
    { functionCall: { name: spec.functionCall, args: extracted, status: 'pending' } },
  )
}

// ═══════════════════════════════════════════════════
//  handleMessage dispatcher
// ═══════════════════════════════════════════════════

async function dispatchMessage(
  spec: ComponentSpec,
  session: GameSession,
  message: string,
  user: { id: string; name: string | null },
): Promise<NextResponse> {
  const subFlow = session.flags!.subFlow as SubFlowState
  subFlow.messages = [...(subFlow.messages ?? []), message]
  const context = (subFlow.context ?? {}) as Record<string, unknown>
  subFlow.context = context

  if (subFlow.step === 'awaitingClientId' || context.awaitingClientId) {
    return handleAwaitingClientId(spec, session, subFlow, context, message, user)
  }

  return handleCollect(spec, session, subFlow, context, message, user)
}

// ─── Collect phase router ────────────────────────

async function handleCollect(
  spec: ComponentSpec,
  session: GameSession,
  subFlow: SubFlowState,
  context: Record<string, unknown>,
  message: string,
  user: { id: string; name: string | null },
): Promise<NextResponse> {
  const collect = spec.collect
  if (!collect) {
    persistSession(session)
    return respond(session, { pa: '请确认操作。', agent: 'No collect config.' })
  }

  if (collect.extract && collect.transitions) {
    return collectEffectDriven(spec, session, subFlow, context, message, user)
  }

  if (spec.dataSource) {
    return collectAppOriented(spec, session, subFlow, context, message)
  }

  if (collect.extractFromMessage) {
    return collectRegexDriven(spec, session, subFlow, context, message)
  }

  persistSession(session)
  return respond(
    session,
    collect.emptyMessage ? dual(collect.emptyMessage) : { pa: '请提供信息。', agent: 'Need input.' },
  )
}

// ─── ClientId resolution (priority-ordered) ─────

async function resolveClientId(
  collect: Collect,
  extracted: Record<string, unknown>,
  subFlow: SubFlowState,
  effectCtx: EffectContext,
): Promise<string | null> {
  if (!collect.clientIdResolution) return null

  const extractedId = extracted.clientId as string | undefined
  if (extractedId) return extractedId

  if (subFlow.messages?.length) {
    try {
      const cid = await invokeEffect(
        'extract.client-id',
        { message: subFlow.messages.join(' ') },
        effectCtx,
      )
      if (typeof cid === 'string' && /^[0-9a-f]{8}-/i.test(cid)) return cid
    } catch { /* regex miss — not an error */ }
  }

  const ctx = (subFlow.context ?? {}) as Record<string, unknown>
  const existingApps = (ctx.existingApps ?? []) as Array<{ clientId: string | null }>
  return existingApps.find(a => a.clientId)?.clientId ?? null
}

// ─── Strategy 1: Effect-driven (register) ────────

async function collectEffectDriven(
  spec: ComponentSpec,
  session: GameSession,
  subFlow: SubFlowState,
  context: Record<string, unknown>,
  message: string,
  user: { id: string; name: string | null },
): Promise<NextResponse> {
  const collect = spec.collect!
  const extractCfg = collect.extract!
  const effectCtx: EffectContext = { session, user }

  const extractArgs: Record<string, unknown> =
    extractCfg.inputField === 'messages'
      ? { messages: subFlow.messages }
      : { message, input: message }

  const raw = (await invokeEffect(
    extractCfg.effect,
    extractArgs,
    effectCtx,
  )) as Record<string, unknown>

  const extracted = (raw.extracted ?? raw) as Record<string, unknown>
  const clientId = await resolveClientId(collect, extracted, subFlow, effectCtx)

  const evalVars: Record<string, unknown> = {
    ...extracted,
    complete: !!raw.complete,
    clientId,
    name: extracted.name || raw.name,
    followUp: raw.followUp ?? extracted.followUp,
  }

  for (const rule of collect.transitions ?? []) {
    if (!evaluateCondition(rule.when, evalVars)) continue

    if (rule.storeExtracted) {
      context.pendingExtracted = extracted
    }

    if (rule.setFlag) {
      const flagMatch = rule.setFlag.match(/^context\.(\w+)\s*=\s*(.+)$/)
      if (flagMatch) {
        context[flagMatch[1]] = flagMatch[2] === 'true' ? true : flagMatch[2]
      }
    }

    subFlow.context = context

    if (rule.goto === 'validationGate' && clientId) {
      return runValidationGate(spec, session, subFlow, context, clientId, user)
    }

    if (rule.goto) {
      subFlow.step = rule.goto
      persistSession(session)
      const msg = rule.message
        ? dual(rule.message)
        : { pa: '需要更多信息。', agent: `Waiting in ${rule.goto} step.` }
      return respond(session, msg)
    }

    persistSession(session)
    const followUp = String(evalVars.followUp ?? '能告诉我你的应用叫什么名字吗？')
    return respond(session, {
      pa: followUp,
      agent: `Registration incomplete. Need: ${!extracted.name ? 'name' : 'more info'}.`,
    })
  }

  persistSession(session)
  return respond(session, {
    pa: String(evalVars.followUp ?? '能告诉我更多信息吗？'),
    agent: 'No transition matched. Need more info.',
  })
}

// ─── AwaitingClientId ────────────────────────────

async function handleAwaitingClientId(
  spec: ComponentSpec,
  session: GameSession,
  subFlow: SubFlowState,
  context: Record<string, unknown>,
  message: string,
  user: { id: string; name: string | null },
): Promise<NextResponse> {
  const cfg = spec.awaitingClientId
  const effectCtx: EffectContext = { session, user }

  let clientId: string | null = null
  if (cfg?.extract) {
    const args: Record<string, unknown> = { message, input: message }
    if (cfg.extract.fallback) args.fallback = message.trim()
    const result = await invokeEffect(cfg.extract.effect, args, effectCtx)
    clientId = typeof result === 'string' && result.trim() ? result : null
  } else {
    clientId = message.trim() || null
  }

  const evalVars = { clientId }

  for (const rule of cfg?.transitions ?? []) {
    if (!evaluateCondition(rule.when, evalVars)) continue

    if (rule.goto === 'validationGate' && clientId) {
      return runValidationGate(spec, session, subFlow, context, clientId, user)
    }

    persistSession(session)
    const msg = rule.message
      ? dual(rule.message)
      : { pa: '请提供 ClientId。', agent: 'Need clientId.' }
    return respond(session, msg)
  }

  if (clientId) {
    return runValidationGate(spec, session, subFlow, context, clientId, user)
  }

  persistSession(session)
  return respond(session, {
    pa: '请告诉我你的 SecondMe 应用 ClientId。',
    agent: 'Still need clientId.',
  })
}

// ─── Validation gate ─────────────────────────────

async function runValidationGate(
  spec: ComponentSpec,
  session: GameSession,
  subFlow: SubFlowState,
  context: Record<string, unknown>,
  clientId: string,
  user: { id: string; name: string | null },
): Promise<NextResponse> {
  const gate = spec.validationGate
  if (!gate) {
    const pending = (context.pendingExtracted ?? {}) as Record<string, unknown>
    return showCard(session, subFlow, spec, { ...pending, clientId })
  }

  const effectCtx: EffectContext = { session, user }
  const validation = (await invokeEffect(gate.effect, { clientId }, effectCtx)) as {
    valid: boolean
    reason?: string
  }

  if (!validation.valid) {
    persistSession(session)
    return respond(session, {
      pa: validation.reason || `ClientId「${clientId}」格式不对，确认一下？`,
      agent: `Validation failed for clientId="${clientId}": ${validation.reason ?? 'unknown'}`,
    })
  }

  const pending = (context.pendingExtracted ?? {}) as Record<string, unknown>
  const extracted = { ...pending, clientId }
  context.awaitingClientId = false
  subFlow.context = context

  return showCard(session, subFlow, spec, extracted, {
    pa: gate.onValid?.message
      ? dual(gate.onValid.message).pa
      : '验证通过！让我整理一下你推荐的应用信息——',
    agent: `Validated & extracted: ${JSON.stringify(extracted)}. Awaiting confirmation.`,
  })
}

// ─── Strategy 2: App-oriented (app-settings, app-lifecycle) ───

async function collectAppOriented(
  spec: ComponentSpec,
  session: GameSession,
  subFlow: SubFlowState,
  context: Record<string, unknown>,
  message: string,
): Promise<NextResponse> {
  const collect = spec.collect!
  const apps = loadApps(session, spec)

  if (!apps.length) {
    persistSession(session)
    return respond(session, dual(collect.emptyMessage!))
  }

  // Single-app auto-select (app-settings)
  if (collect.singleAppAutoSelect && apps.length === 1) {
    context.appId = apps[0].id
    context.appName = apps[0].name
    subFlow.context = context
    const extracted = buildExtracted(spec, context, apps[0])
    return showCard(session, subFlow, spec, extracted, {
      pa: `正在编辑「${apps[0].name}」——可以在卡片中修改信息，点确认保存。`,
      agent: `Editing app ${apps[0].id}. Current values presented in card.`,
    })
  }

  // Resolve app from message
  if (!context.appId && collect.resolveFromMessage) {
    let selected = matchApp(message, apps)
    if (!selected && collect.resolveFromMessage.defaultIfSingle && apps.length === 1) {
      selected = apps[0]
    }
    if (selected) {
      context.appId = selected.id
      context.appName = selected.name
    }
  }

  // Extract status intent (app-lifecycle)
  if (collect.extractStatusIntent && !context.newStatus) {
    const intent = matchStatusIntent(
      message,
      collect.extractStatusIntent as Record<string, string>,
    )
    if (intent) context.newStatus = intent
  }

  subFlow.context = context

  if (isReadyForConfirm(spec, context)) {
    const app = apps.find(a => a.id === context.appId) ?? null
    const extracted = buildExtracted(spec, context, app)

    let cardMsg: { pa: string; agent: string }
    if (context.newStatus) {
      const labels: Record<string, string> = { archived: '归档', inactive: '暂停', active: '恢复' }
      const label = labels[context.newStatus as string] ?? String(context.newStatus)
      cardMsg = {
        pa: `收到！确认将「${context.appName}」${label}？`,
        agent: `App lifecycle change. appId: ${context.appId}, newStatus: ${context.newStatus}.`,
      }
    } else if (app) {
      cardMsg = {
        pa: `正在编辑「${app.name}」——可以在卡片中修改信息，点确认保存。`,
        agent: `Editing app ${app.id}. Current values presented in card.`,
      }
    } else {
      cardMsg = { pa: '收到！确认一下——', agent: `Presenting ${spec.id} card.` }
    }

    return showCard(session, subFlow, spec, extracted, cardMsg)
  }

  // Follow-up
  persistSession(session)

  if (collect.followUpMessage) {
    const fm = collect.followUpMessage

    if ('pa' in fm && 'agent' in fm) {
      const appList = apps.map((a, i) => `${i + 1}. ${a.name}`).join('、')
      return respond(
        session,
        interpMsg({ pa: fm['pa'] ?? '', agent: fm['agent'] ?? '' }, { appList }),
      )
    }

    if (!context.appId && fm['needApp']) {
      return respond(session, { pa: fm['needApp'], agent: 'Need app selection.' })
    }
    if (fm['needStatus']) {
      return respond(session, { pa: fm['needStatus'], agent: 'Need status intent.' })
    }
  }

  const appList = apps.map((a, i) => `${i + 1}. ${a.name}`).join('、')
  return respond(session, {
    pa: `你有这些应用：${appList}。想编辑哪个？`,
    agent: `Need app selection. Apps: ${appList}`,
  })
}

// ─── Strategy 3: Regex-driven (profile) ──────────

async function collectRegexDriven(
  spec: ComponentSpec,
  session: GameSession,
  subFlow: SubFlowState,
  context: Record<string, unknown>,
  message: string,
): Promise<NextResponse> {
  const collect = spec.collect!
  let changes = (context.changes as Record<string, string>) ?? {}

  if (collect.extractFromMessage?.patterns) {
    const extracted = applyRegexPatterns(message, collect.extractFromMessage.patterns)
    if (collect.preferenceMapping) {
      applyPreferenceMapping(extracted, collect.preferenceMapping)
    }
    if (Object.keys(extracted).length > 0) {
      changes = { ...changes, ...extracted }
      context.changes = changes
    }
  }

  subFlow.context = context

  if (isReadyForConfirm(spec, context)) {
    const data = buildExtracted(spec, context)
    return showCard(session, subFlow, spec, data, {
      pa: '收到！确认一下修改内容——',
      agent: `Profile update. changes: ${JSON.stringify(changes)}.`,
    })
  }

  persistSession(session)
  return respond(
    session,
    collect.emptyMessage
      ? dual(collect.emptyMessage)
      : { pa: '请告诉我要修改什么。', agent: 'Need changes.' },
  )
}

// ═══════════════════════════════════════════════════
//  handleConfirm
// ═══════════════════════════════════════════════════

async function executeConfirm(
  spec: ComponentSpec,
  session: GameSession,
  args: Record<string, unknown>,
  user: { id: string; name: string | null },
): Promise<NextResponse> {
  const confirm = spec.actions.confirm
  const effectCtx: EffectContext = { session, user }

  try {
    // 1. Validate required params
    for (const [key, schema] of Object.entries(confirm.params)) {
      if (!schema.required) continue
      const val = args[key]
      if (val === undefined || val === null || val === '') {
        return respondError(`缺少必填字段: ${key}`)
      }
      if (
        schema.type === 'object' &&
        typeof val === 'object' &&
        Object.keys(val as object).length === 0
      ) {
        return respondError(`缺少 ${key}`)
      }
    }

    // 2. Build effect args (apply effectArgs mapping if specified)
    let effectArgs: Record<string, unknown>
    if (confirm.effectArgs) {
      effectArgs = resolveEffectArgs(
        confirm.effectArgs as Record<string, unknown>,
        args,
        user,
      )
    } else {
      effectArgs = { ...args }
    }

    // 3. Invoke primary effect
    const result = await invokeEffect(confirm.effect, effectArgs, effectCtx)

    // 4. Run post-effects
    if (confirm.postEffect) {
      for (const pe of confirm.postEffect) {
        const peArgs = resolvePostEffectArgs(pe.args, result, args)
        try {
          await invokeEffect(pe.effect, peArgs, effectCtx)
        } catch (err) {
          console.error(`Post-effect ${pe.effect} failed:`, err)
        }
      }
    }

    // 5. Clear SubFlow
    if (confirm.onSuccess?.clearSubFlow !== false) {
      if (session.flags?.subFlow) {
        session.flags = { ...session.flags, subFlow: undefined }
        persistSession(session)
      }
    }

    // 6. Build success response
    const extra: Record<string, unknown> = {}
    if (confirm.onSuccess?.returnExtra) {
      for (const [k, mapping] of Object.entries(confirm.onSuccess.returnExtra)) {
        extra[k] = resolveRef(mapping, result, args)
      }
    }

    const vars = flattenVars(args, result)
    const successMsg = confirm.onSuccess?.message
      ? interpMsg(dual(confirm.onSuccess.message), vars)
      : { pa: '操作成功！', agent: `${spec.id} confirmed.` }

    return respond(session, successMsg, extra)
  } catch (error) {
    console.error(`${spec.id} confirm failed:`, error)

    if (error instanceof EffectError) {
      return respondError(error.message, error.status)
    }

    const errMsg = confirm.onError?.message
      ? dual(confirm.onError.message)
      : { pa: '操作失败，请重试', agent: `${spec.id} confirm error.` }
    return respondError(errMsg.pa, confirm.onError?.errorStatus ?? 500)
  }
}

// ─── Effect args resolution ──────────────────────

function resolveEffectArgs(
  template: Record<string, unknown>,
  args: Record<string, unknown>,
  user: { id: string; name: string | null },
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(template)) {
    if (typeof v === 'string') {
      if (v.startsWith('params.')) out[k] = args[v.slice(7)]
      else if (v === 'user.id') out[k] = user.id
      else out[k] = v
    } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      out[k] = resolveEffectArgs(v as Record<string, unknown>, args, user)
    } else {
      out[k] = v
    }
  }
  return out
}

function resolvePostEffectArgs(
  template: Record<string, unknown> | undefined,
  result: unknown,
  args: Record<string, unknown>,
): Record<string, unknown> {
  if (!template) return {}
  const out: Record<string, unknown> = {}
  const res = (result ?? {}) as Record<string, unknown>

  for (const [k, v] of Object.entries(template)) {
    if (typeof v !== 'string') {
      out[k] = v
      continue
    }
    if (v.startsWith('created.') || v.startsWith('result.') || v.startsWith('updated.')) {
      out[k] = res[v.split('.').slice(1).join('.')]
    } else if (v === 'now') {
      out[k] = new Date()
    } else if (v.startsWith('params.')) {
      out[k] = args[v.slice(7)]
    } else {
      out[k] = v
    }
  }
  return out
}

// ─── Reference resolution (returnExtra) ──────────

function resolveRef(
  mapping: unknown,
  result: unknown,
  args: Record<string, unknown>,
): unknown {
  if (typeof mapping === 'string') {
    if (
      mapping.startsWith('created.') ||
      mapping.startsWith('updated.') ||
      mapping.startsWith('result.')
    ) {
      return (result as Record<string, unknown>)?.[mapping.split('.').slice(1).join('.')]
    }
    if (mapping.startsWith('params.')) return args[mapping.slice(7)]
    return mapping
  }
  if (typeof mapping === 'object' && mapping !== null && !Array.isArray(mapping)) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(mapping as Record<string, unknown>)) {
      out[k] = resolveRef(v, result, args)
    }
    return out
  }
  return mapping
}

function flattenVars(
  args: Record<string, unknown>,
  result: unknown,
): Record<string, unknown> {
  const vars: Record<string, unknown> = { ...args }
  if (typeof result === 'object' && result !== null) {
    for (const [k, v] of Object.entries(result as Record<string, unknown>)) {
      vars[k] = v
    }
  }
  return vars
}
