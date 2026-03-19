/**
 * PA Lifecycle — Session Context Projection
 *
 * Projects session state + action preconditions into structured text
 * for AI prompts (classifier and NPC). This is the "ontology language"
 * bridge between the engine's state machine and the AI layers.
 *
 * Architecture: docs/pa-lifecycle-architecture.md §4
 */

import type {
  GameSession,
  SceneAction,
  ActionConstraint,
  FCResult,
  SceneScopedFlags,
  ReturnContext,
  SceneAchievement,
} from './types'
import { describeFCForNPC, getOntology, getOperationalOntology, getSceneLabel } from './ontology'
import { buildBehaviorCognition } from '../behavior-engine'
import { persistSession } from './session'
import { evaluate, PreconditionSyntaxError } from './precondition-eval'

const SCENE_SCOPED_KEYS: (keyof SceneScopedFlags)[] = [
  'experiencingApp',
  'hasExperienced',
  'subFlow',
]

export function clearSceneScopedFlags(session: GameSession): void {
  if (!session.flags) return
  for (const key of SCENE_SCOPED_KEYS) {
    delete session.flags[key]
  }
}

const LEGACY_PRECONDITIONS: Record<string, (s: GameSession) => boolean> = {
  hasExperienced: s => s.flags?.hasExperienced === true,
  hasApps:        s => s.data?.hasApps === true,
  notDeveloper:   s => s.data?.isDeveloper === false,
  isDeveloper:    s => s.data?.isDeveloper === true,
}

export function checkPrecondition(check: string, session: GameSession): boolean {
  try {
    return evaluate(check, session)
  } catch (e) {
    if (e instanceof PreconditionSyntaxError) {
      const legacy = LEGACY_PRECONDITIONS[check]
      if (legacy) return legacy(session)
      return true
    }
    throw e
  }
}

export function buildActionConstraints(
  actions: SceneAction[],
  session: GameSession,
): ActionConstraint[] {
  return actions.map(a => {
    if (!a.precondition) {
      return { actionId: a.id, available: true }
    }
    const passed = checkPrecondition(a.precondition.check, session)
    return {
      actionId: a.id,
      available: passed,
      reason: passed ? undefined : a.precondition.failMessage.pa,
    }
  })
}

export function buildSessionContextForClassifier(
  session: GameSession,
  actions: SceneAction[],
): string {
  const constraints = buildActionConstraints(actions, session)
  const parts: string[] = []

  const stateLines: string[] = []
  const app = session.flags?.experiencingApp as { name: string } | undefined
  stateLines.push(`- 正在体验的应用：${app ? app.name : '无'}`)
  stateLines.push(`- 已完成体验：${session.flags?.hasExperienced ? '是' : '否'}`)
  parts.push(`当前会话状态：\n${stateLines.join('\n')}`)

  const constraintLines = constraints.map(c => {
    if (c.available) return `- [${c.actionId}] 可用`
    return `- [${c.actionId}] 不可用（${c.reason}）`
  })
  parts.push(`操作可用性：\n${constraintLines.join('\n')}`)

  parts.push('重要：不可用的操作不应被匹配。如果用户意图指向不可用操作，返回空 actionId。')

  const classifierCognition = buildBehaviorCognition(session, 'classifier')
  if (classifierCognition) parts.push(classifierCognition)

  return parts.join('\n\n')
}

export function buildSessionContextForNPC(
  session: GameSession,
  actions: SceneAction[],
  fcResult?: FCResult,
): string {
  const constraints = buildActionConstraints(actions, session)
  const parts: string[] = []

  const available = constraints.filter(c => c.available)
  const gated = constraints.filter(c => !c.available)

  const stateLines: string[] = []
  const app = session.flags?.experiencingApp as { name: string } | undefined
  if (app) {
    stateLines.push(`- 访客正在体验「${app.name}」`)
  } else if (session.flags?.hasExperienced) {
    stateLines.push('- 访客已体验过应用，可以提交报告')
  } else {
    stateLines.push('- 访客尚未体验过任何应用')
  }

  if (available.length > 0) {
    const labels = available.map(c => {
      const action = actions.find(a => a.id === c.actionId)
      return action?.label.pa || c.actionId
    })
    stateLines.push(`- 可用操作：${labels.join('、')}`)
  }

  if (gated.length > 0) {
    for (const g of gated) {
      const action = actions.find(a => a.id === g.actionId)
      stateLines.push(`- 不可用：${action?.label.pa || g.actionId}（原因：${g.reason}）`)
    }
  }

  parts.push(`会话状态：\n${stateLines.join('\n')}`)

  if (gated.length > 0) {
    parts.push('如果访客想做不可用的操作，用你的方式引导他先做前置步骤。')
  }

  if (fcResult) {
    parts.push(`操作执行结果：\n- ${describeFCForNPC(fcResult)}`)
  }

  const journeyLines: string[] = []

  const visited = (session.flags?.visitedScenes ?? []) as string[]
  if (visited.length > 1) {
    journeyLines.push(`- 已访问过的场景：${visited.map(s => getSceneLabel(s)).join('、')}`)
  }

  const returnCtx = session.flags?.returnContext as ReturnContext | undefined
  if (returnCtx) {
    journeyLines.push(`- 刚从「${getSceneLabel(returnCtx.fromScene)}」回来`)
    journeyLines.push(`- 返回原因：${returnCtx.summary}`)
    if (returnCtx.recommendation) {
      journeyLines.push(`- ${returnCtx.npcName}建议去：${getSceneLabel(returnCtx.recommendation)}`)
    }
  }

  const goal = session.flags?.currentGoal as PAGoal | undefined
  if (goal) {
    journeyLines.push(`- 当前目标：${goal.purpose}`)
  }

  const events = (session.flags?.recentEvents ?? []) as string[]
  if (events.length > 0) {
    journeyLines.push(`- 最近经历：${events.slice(-3).join('；')}`)
  }

  if (journeyLines.length > 0) {
    parts.push(`访客旅程记忆：\n${journeyLines.join('\n')}`)
  }

  const npcCognition = buildBehaviorCognition(session, 'npc')
  if (npcCognition) parts.push(npcCognition)

  return parts.join('\n\n')
}

// ─── PA Goal (Purpose-Driven Movement) ──────────

export interface PAGoal {
  purpose: string
  derivedFrom: string
  sceneId: string
}

export function getCurrentGoal(session: GameSession): PAGoal | null {
  return (session.flags?.currentGoal as PAGoal) ?? null
}

export function setCurrentGoal(session: GameSession, goal: PAGoal | null): void {
  session.flags = { ...session.flags, currentGoal: goal }
}

// ─── Return Context (cross-scene memory) ────────

export function getReturnContext(session: GameSession): ReturnContext | null {
  return (session.flags?.returnContext as ReturnContext) ?? null
}

export function setReturnContext(session: GameSession, ctx: ReturnContext | null): void {
  session.flags = { ...session.flags, returnContext: ctx ?? undefined }
}

/**
 * Compute and persist return context when a scene transition goes back to lobby.
 * Returns the returnReason string for event logging, or undefined if no transition to lobby.
 */
export function computeReturnContext(
  session: GameSession,
  attemptedTransition: { from: string; to: string } | null,
  fcResult?: FCResult,
): string | undefined {
  if (!attemptedTransition || attemptedTransition.to !== 'lobby') return undefined

  const fromScene = attemptedTransition.from
  const npcName = getOntology().scenes[fromScene]?.npc ?? '未知'

  let rcReason: ReturnContext['reason']
  let recommendation: string | undefined
  let summary: string
  let returnReason: string

  if (session.data?.hasApps === false) {
    rcReason = 'no_data'
    recommendation = fromScene === 'developer' ? 'news' : 'developer'
    const hint = fromScene === 'developer'
      ? `${npcName}建议先去日报栏逛逛`
      : `${npcName}建议去开发者空间注册`
    summary = `目前没有应用入驻，${hint}`
    returnReason = 'no_data'
  } else if (fcResult?.status === 'executed' && !isNavigationFC(fcResult.name)) {
    rcReason = 'task_complete'
    summary = `在场景中完成了操作后返回`
    returnReason = 'goal_completed'
  } else {
    rcReason = 'pa_initiative'
    summary = `访客主动返回大厅`
    returnReason = 'pa_initiative'
  }

  setReturnContext(session, { fromScene, npcName, reason: rcReason, recommendation, summary })

  if (!getCurrentGoal(session) && recommendation) {
    const goalLabels: Record<string, string> = {
      developer: `去${getSceneLabel('developer')}推荐应用给日报`,
      news: `去${getSceneLabel('news')}看看热门应用`,
    }
    setCurrentGoal(session, {
      purpose: goalLabels[recommendation] || `去${getSceneLabel(recommendation)}`,
      derivedFrom: summary.slice(0, 80),
      sceneId: fromScene,
    })
  }

  persistSession(session)
  return returnReason
}

// ─── Achievements ────────────────────────────────

const NAVIGATION_FCS = new Set(
  Object.entries(getOperationalOntology().functionCalls)
    .filter(([, entry]) => entry.category === 'navigation')
    .map(([name]) => name),
)

export function isNavigationFC(name: string): boolean {
  return NAVIGATION_FCS.has(name)
}

export function recordAchievement(
  session: GameSession,
  achievement: Omit<SceneAchievement, 'timestamp'>,
): void {
  if (NAVIGATION_FCS.has(achievement.actionId)) return
  const list = ((session.flags?.achievements as SceneAchievement[]) ?? []).slice()
  list.push({ ...achievement, timestamp: Date.now() })
  session.flags = { ...session.flags, achievements: list }
}

// ─── Scene Turn Counter ──────────────────────────

export function incrementSceneTurns(session: GameSession): void {
  const current = (session.flags?.sceneTurns as number) ?? 0
  session.flags = { ...session.flags, sceneTurns: current + 1 }
}

export function resetSceneTurns(session: GameSession): void {
  session.flags = { ...session.flags, sceneTurns: 0 }
}

/**
 * Record a brief event description into session journey memory.
 */
export function recordEvent(session: GameSession, event: string): void {
  const events = (session.flags?.recentEvents ?? []) as string[]
  events.push(event)
  if (events.length > 10) events.splice(0, events.length - 10)
  session.flags = { ...session.flags, recentEvents: events }
}

