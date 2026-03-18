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
import { describeFCForNPC, getOperationalOntology, getSceneLabel } from './ontology'

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

export function checkPrecondition(check: string, session: GameSession): boolean {
  if (check === 'hasExperienced') return session.flags?.hasExperienced === true
  if (check === 'hasApps') return session.data?.hasApps === true
  if (check === 'notDeveloper') return session.data?.isDeveloper === false
  if (check === 'isDeveloper') return session.data?.isDeveloper === true
  return true
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

/**
 * Record a brief event description into session journey memory.
 */
export function recordEvent(session: GameSession, event: string): void {
  const events = (session.flags?.recentEvents ?? []) as string[]
  events.push(event)
  if (events.length > 10) events.splice(0, events.length - 10)
  session.flags = { ...session.flags, recentEvents: events }
}

