import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

const sessions = await p.gameSessionLog.findMany({
  where: { engineVersion: '10' },
  orderBy: { startedAt: 'desc' },
})

console.log(`=== v10 Sessions: ${sessions.length} ===`)
for (const s of sessions) {
  console.log('')
  console.log(`Session: ${s.sessionId}`)
  console.log(`  Agent: ${s.agentName} | Mode: ${s.mode} | Turns: ${s.totalTurns}`)
  console.log(`  End: ${s.endReason || '(active)'} | Loops: ${s.loopsDetected} | Errors: ${s.errorsOccurred}`)
  console.log(`  Scenes: ${JSON.stringify(s.scenesVisited)}`)
  console.log(`  Started: ${s.startedAt.toISOString()}`)
}

if (sessions.length > 0) {
  const sid = sessions[0].sessionId
  console.log(`\n=== Turn details for latest session (${sid}) ===\n`)

  const turns = await p.gameTurnLog.findMany({
    where: { sessionId: sid },
    orderBy: { turnNumber: 'asc' },
  })

  for (const t of turns) {
    const input = t.inputContent ? t.inputContent.substring(0, 80) : '(none)'
    const npc = t.npcReply ? t.npcReply.substring(0, 100) : '(none)'
    console.log(`T${t.turnNumber} [${t.sceneId}] ${t.action} → ${t.actionMatched || '-'} (${t.matchMethod || '-'})`)
    console.log(`  Input: ${input}`)
    console.log(`  NPC:   ${npc}`)
    console.log(`  Classifier: conf=${t.classifierConfidence ?? '-'} src=${t.classifierSource ?? '-'}`)
    console.log(`  PA: intent=${t.paIntent ?? '-'} conf=${t.paConfidence ?? '-'}`)
    console.log(`  Outcome: ${t.outcomeType || '-'} | FC: ${t.functionCallName || '-'} (${t.functionCallStatus || '-'})`)
    if (t.transitionTo) console.log(`  Transition: ${t.transitionFrom} → ${t.transitionTo}`)
    if (t.paGoal) console.log(`  PA Goal: ${t.paGoal}`)
    if (t.returnReason) console.log(`  Return Reason: ${t.returnReason}`)
    if (t.loopDetected) console.log(`  ⚠️ LOOP: ${t.guardType || 'unknown'}`)
    if (t.npcGenerateMs) console.log(`  NPC gen: ${t.npcGenerateMs}ms`)
    console.log(`  Duration: ${t.durationMs || '-'}ms`)
    console.log('')
  }
}

await p.$disconnect()
