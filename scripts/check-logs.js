const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

const cmd = process.argv[2]
const versionFilter = process.argv[3]

const LABELS = { lobby: '大厅', news: '日报栏', developer: '开发者空间' }
const label = (s) => LABELS[s] || s
const clip = (s, n = 60) => s && s.length > n ? s.slice(0, n) + '…' : s

// ─── Story Mode (default) ───────────────────────
// One session = one readable journey

async function showStory() {
  const where = versionFilter ? { engineVersion: versionFilter } : {}
  const sessions = await p.gameSessionLog.findMany({
    where,
    take: 5,
    orderBy: { startedAt: 'desc' },
    include: { turns: { orderBy: { createdAt: 'asc' } } },
  })

  if (sessions.length === 0) {
    console.log(`No sessions found${versionFilter ? ` for v${versionFilter}` : ''}.`)
    return
  }

  for (const sess of sessions) {
    const dur = Math.round((sess.lastActiveAt - sess.startedAt) / 1000)
    const endTag = sess.endReason ? ` → ${END_LABELS[sess.endReason] || sess.endReason}` : ' (open)'

    console.log()
    console.log(`${'━'.repeat(70)}`)
    console.log(`  v${sess.engineVersion} | ${sess.agentName} | ${sess.mode} | ${sess.totalTurns} turns | ${dur}s${endTag}`)
    console.log(`${'━'.repeat(70)}`)

    let currentScene = null

    for (const t of sess.turns) {
      // Scene entry
      if (t.action === 'enter') {
        const scn = label(t.sceneId)
        if (t.transitionFrom) {
          console.log(`\n  🚶 ${label(t.transitionFrom)} → ${scn}`)
        } else {
          console.log(`\n  📍 ${scn}`)
        }
        if (t.paGoal) console.log(`     🎯 ${t.paGoal}`)
        if (t.npcReply) console.log(`     NPC: "${clip(t.npcReply, 80)}"`)
        if (t.returnReason) console.log(`     ↩ ${t.returnReason}`)
        currentScene = t.sceneId
        continue
      }

      // Message turn
      if (t.action === 'message') {
        const pa = clip(t.inputContent, 70)
        const npc = clip(t.npcReply, 70)
        const scn = label(t.sceneId)

        // Show scene header if scene changed (same-scene messages group together)
        if (t.sceneId !== currentScene) {
          console.log(`\n  📍 ${scn}`)
          currentScene = t.sceneId
        }

        // PA line
        let paLine = `     PA: "${pa}"`
        if (t.paGoal) paLine += `  🎯${t.paGoal}`
        console.log(paLine)

        // Flags line (compact)
        const flags = []
        if (t.actionMatched) flags.push(t.actionMatched)
        if (t.transitionTo) flags.push(`→ ${label(t.transitionTo)}`)
        if (t.returnReason) flags.push(`↩${t.returnReason}`)
        if (t.loopDetected) flags.push('⚠LOOP')
        if (t.errorOccurred) flags.push('❌ERR')
        if (flags.length > 0) console.log(`         [${flags.join(' | ')}]`)

        // NPC line
        if (npc) console.log(`     NPC: "${npc}"`)

        continue
      }

      // SubFlow
      if (t.action === 'subflow_confirm') {
        console.log(`     📋 SubFlow confirm`)
        if (t.npcReply) console.log(`     NPC: "${clip(t.npcReply, 70)}"`)
      }
    }

    // Session end
    if (sess.endReason) {
      console.log(`\n  🏁 ${END_LABELS[sess.endReason] || sess.endReason}`)
    }
    console.log()
  }
}

const END_LABELS = {
  pa_leave: '🚪 PA 主动离开',
  loop_guard: '🔄 循环保护触发',
  navigator_exhausted: '😵 导航耗尽',
  timeout: '⏰ 超时',
}

// ─── Detail Mode (verbose) ──────────────────────

async function showLogs() {
  const where = versionFilter ? { engineVersion: versionFilter } : {}
  const sessions = await p.gameSessionLog.findMany({
    where,
    take: 10,
    orderBy: { startedAt: 'desc' },
    include: { turns: { orderBy: { createdAt: 'asc' } } },
  })

  if (sessions.length === 0) {
    console.log(`No sessions found${versionFilter ? ` for version ${versionFilter}` : ''}.`)
    return
  }

  const versionCounts = {}
  for (const s of sessions) {
    versionCounts[s.engineVersion] = (versionCounts[s.engineVersion] || 0) + 1
  }
  console.log('=== Version Distribution ===')
  for (const [v, c] of Object.entries(versionCounts)) {
    console.log(`  v${v}: ${c} sessions`)
  }

  for (const sess of sessions) {
    console.log(`\n${'='.repeat(80)}`)
    console.log(`SESSION: ${sess.sessionId} [v${sess.engineVersion}]`)
    console.log(`User: ${sess.agentName}, Mode: ${sess.mode}, Turns: ${sess.totalTurns}`)
    console.log(`Scenes: ${JSON.stringify(sess.scenesVisited)}`)
    console.log(`Loops: ${sess.loopsDetected}, Errors: ${sess.errorsOccurred}`)
    if (sess.endReason) console.log(`End Reason: ${sess.endReason}`)
    console.log(`Started: ${sess.startedAt.toISOString()}, Last: ${sess.lastActiveAt.toISOString()}`)
    console.log(`${'─'.repeat(80)}`)

    for (const t of sess.turns) {
      console.log(`\n  Turn #${t.turnNumber} | Scene: ${t.sceneId} | Action: ${t.action} | Mode: ${t.mode}`)
      if (t.actionMatched) console.log(`  ActionMatched: ${t.actionMatched} | Method: ${t.matchMethod}`)
      if (t.outcomeType) console.log(`  Outcome: ${t.outcomeType}`)
      if (t.functionCallName) console.log(`  FC: ${t.functionCallName} (${t.functionCallStatus})`)
      if (t.transitionFrom) console.log(`  Transition: ${t.transitionFrom} → ${t.transitionTo}`)
      if (t.loopDetected) console.log(`  ⚠️ LOOP DETECTED`)
      if (t.errorOccurred) console.log(`  ❌ ERROR: ${t.errorDetail}`)
      if (t.isSubFlow) console.log(`  📋 SubFlow`)
      if (t.durationMs) console.log(`  Duration: ${t.durationMs}ms`)
      if (t.paGoal) console.log(`  🎯 PA Goal: ${t.paGoal}`)
      if (t.returnReason) console.log(`  ↩️ Return Reason: ${t.returnReason}`)
      if (t.inputContent) console.log(`  PA Input: ${t.inputContent.slice(0, 200)}`)
      if (t.npcReply) console.log(`  NPC Reply: ${t.npcReply.slice(0, 200)}`)
      console.log(`  Time: ${t.createdAt.toISOString()}`)
    }
  }
}

// ─── Stats Mode ─────────────────────────────────

async function showStats() {
  const all = await p.gameSessionLog.findMany()
  const byVersion = {}
  for (const s of all) {
    const v = s.engineVersion || '1'
    if (!byVersion[v]) byVersion[v] = { sessions: 0, totalTurns: 0, loops: 0, errors: 0, scenes: new Set(), endReasons: {} }
    const b = byVersion[v]
    b.sessions++
    b.totalTurns += s.totalTurns
    b.loops += s.loopsDetected
    b.errors += s.errorsOccurred
    for (const sc of (s.scenesVisited || [])) b.scenes.add(sc)
    if (s.endReason) b.endReasons[s.endReason] = (b.endReasons[s.endReason] || 0) + 1
  }

  console.log('=== Version Comparison ===\n')
  for (const [v, b] of Object.entries(byVersion).sort()) {
    console.log(`── v${v} ──`)
    console.log(`  Sessions: ${b.sessions}`)
    console.log(`  Total turns: ${b.totalTurns} (avg ${(b.totalTurns / b.sessions).toFixed(1)}/session)`)
    console.log(`  Loops detected: ${b.loops}`)
    console.log(`  Errors: ${b.errors}`)
    console.log(`  Unique scenes: ${[...b.scenes].join(', ')}`)
    if (Object.keys(b.endReasons).length > 0) {
      console.log(`  End reasons: ${JSON.stringify(b.endReasons)}`)
    } else {
      console.log(`  End reasons: none (all expired by TTL)`)
    }
    console.log()
  }
}

// ─── Help ───────────────────────────────────────

function showHelp() {
  console.log(`
Usage: node scripts/check-logs.js [command] [version]

Commands:
  (default)    Story view — each session as a readable journey
  detail       Verbose per-turn dump (old format)
  stats        Version comparison table
  help         This message

Examples:
  node scripts/check-logs.js              # latest 5 sessions, story view
  node scripts/check-logs.js 6            # v6 sessions only, story view
  node scripts/check-logs.js detail 6     # v6 verbose
  node scripts/check-logs.js stats        # all versions comparison
`)
}

// ─── Main ───────────────────────────────────────

async function main() {
  // Allow `node check-logs.js 6` as shorthand for version filter
  let command = cmd
  let version = versionFilter
  if (cmd && /^\d+$/.test(cmd)) {
    command = undefined
    version = cmd
  }

  switch (command) {
    case 'detail':
    case 'logs':
      await showLogs()
      break
    case 'stats':
      await showStats()
      break
    case 'help':
    case '--help':
    case '-h':
      showHelp()
      break
    default:
      await showStory()
      break
  }
  await p.$disconnect()
}
main()
