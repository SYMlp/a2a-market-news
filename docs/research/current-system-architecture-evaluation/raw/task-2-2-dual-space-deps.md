# Task 2.2 Raw: Dual-Space Dependency Matrix

## Agent Space API (api/gm/*)

| Route | Imports |
|-------|---------|
| gm/process | gm/engine, engine/session, session-context, conversation-guard, gm/function-call-executor, event-logger, ontology, gm/route-utils |
| gm/pa-respond | engine/session, conversation-guard, session-context, ontology, **pa-actions** (callSecondMeStream) |
| gm/turn | gm/engine |
| gm/report | (handler-registry) |
| gm/recommend | - |
| gm/developer-status | - |

## Human Space API (non-gm)

| Route | Imports |
|-------|---------|
| pa-action/* | pa-actions, gamification |
| points/* | gamification |
| circles/* | prisma, (inline) |
| developer/* | prisma, notification |
| practices/* | prisma, (inline) |
| pa-directory/* | prisma, (inline) |

## Cross-space imports

| Agent Space Module | Imports Human Space? |
|--------------------|----------------------|
| component-runtime/handler-registry | ✅ gamification (rewardReview) — 设计意图：副作用对齐 |
| gm/pa-respond | ✅ pa-actions (callSecondMeStream) — PA 顾问模式 |
| api/mcp | ✅ gm/engine + pa-actions + gamification — 混合入口 |

## Shared (neutral)

- prisma.ts — 双方使用
- auth (SecondMe) — 双方使用
- api-utils (requireAuth) — Human Space 为主
