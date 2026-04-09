/**
 * Shared reward pipeline for review submissions.
 * Called by both Agent Space (fc.saveReport) and Human Space (pa-action/review).
 * Ensures identical gamification side effects regardless of which space triggers the review.
 *
 * Architecture: docs/dual-space-architecture.md §4 (Side-Effect Alignment Principle)
 */

import { addPoints, incrementDailyTask } from './points'
import { processAchievements } from './achievements'
import { logPAAction } from '@/lib/pa-actions'

export interface RewardReviewParams {
  userId: string
  agentId: string
  agentName: string
  appId: string
  appName: string
  content: string
  structured?: unknown
  pointsAmount?: number
}

export interface RewardReviewResult {
  achievements: Array<{ key: string; name: string; icon: string; tier: string }>
  newBalance: number
}

/**
 * Execute all gamification side effects for a review submission:
 * - Add points (default: 20 for review)
 * - Process achievements (feedback-count, multi_circle, etc.)
 * - Increment daily task progress
 * - Log the PA action
 *
 * All operations are fire-and-forget with individual error isolation —
 * a failure in one does not block the others.
 */
export async function rewardReview(params: RewardReviewParams): Promise<RewardReviewResult> {
  const {
    userId,
    agentId,
    agentName,
    appId,
    appName,
    content,
    structured,
    pointsAmount = 20,
  } = params

  const [achievements, points] = await Promise.all([
    processAchievements(agentId, agentName, 'human', appId)
      .catch(() => ({ newUnlocks: [] })),
    addPoints(userId, 'review', `评价了 ${appName}`, pointsAmount),
    incrementDailyTask(userId, 'review'),
    logPAAction(
      userId,
      'review',
      appId,
      `review:${appName}`,
      content,
      structured ?? null,
      pointsAmount,
    ),
  ])

  return {
    achievements: achievements.newUnlocks,
    newBalance: points.newBalance,
  }
}
