# Task 5 Raw: AppFeedback Data Flow

## Agent Space path

fc.saveReport (handler-registry) →
  - prisma.appFeedback.create (source: gm_report)
  - rewardReview() from gamification

## Human Space path

pa-action/review (confirm=true) →
  - prisma.appFeedback.create (source: pa_action)
  - rewardReview() from gamification

## Side-effect alignment

Both paths call rewardReview(). ✅ Aligned.

rewardReview does: addPoints, processAchievements, incrementDailyTask, logPAAction.

## Session state

session-context.ts: setReturnContext, recordEvent, clearSceneScopedFlags, etc.
session.flags, session.data — modified via session-context functions.
Route layer: process/route calls recordEvent, setReturnContext, etc. — does NOT directly assign session.flags. ✅
