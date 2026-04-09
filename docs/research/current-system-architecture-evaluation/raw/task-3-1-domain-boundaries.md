# Task 3.1 Raw: Human Space 6 Domains Boundary

## Domain vs code

| Domain | Lib | API routes | Inline logic | Cross-domain |
|--------|-----|------------|--------------|--------------|
| Community | None | circles/*, posts/* | Yes | - |
| Gamification | gamification/ | points/*, achievements/*, daily-tasks, hall-of-fame, season | No (uses lib) | reward-pipeline → pa-actions (logPAAction) |
| PA Actions | pa-actions/ | pa-action/*, my-reviews, pa-activity | No | Uses gamification |
| Practices | None | practices/* | Yes | - |
| PA Directory | None | pa-directory/* | Yes | Reads AchievementUnlock (gamification data) |
| Developer | notification.ts | developer/* | Partial | - |

## "Logic is inline" domains (human-space-domain-map)

- Community: circles route ~35 lines, prisma only
- Practices: practices route ~97 lines, api-utils + prisma
- PA Directory: ~63 lines, prisma + AchievementUnlock join

## Cross-domain calls

- gamification/reward-pipeline → pa-actions (logPAAction)
- pa-action routes → gamification (addPoints, rewardReview, incrementDailyTask)
- pa-directory reads AchievementUnlock (gamification model) — data dependency, not lib
