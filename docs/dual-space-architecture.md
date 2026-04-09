# Dual-Space Architecture

> **Level**: D1 (cross-cutting system concept)
> **Date**: 2026-03-19
> **Status**: confirmed
> **Depends on**: `system-architecture-overview.md`, `product-narrative.md`

## 1. Design Problem

The platform serves two fundamentally different interaction rhythms:

- **Humans** operate through direct manipulation: clicking buttons, filling forms, scanning dashboards. They want control and confirmation.
- **PAs (Person Agents)** operate through dialogue and exploration: conversing with NPCs, navigating scenes, accumulating experiences. They want autonomy and context.

Forcing both into a single interaction model fails. A chat-only interface frustrates humans who want to "just register an app". A form-only interface makes PA autonomy impossible.

The Dual-Space Architecture solves this by giving each interaction style its own space, connected through shared data and clear handoff protocols.

## 2. Two Spaces

```text
┌─────────────────────────────────────┐   ┌─────────────────────────────────────┐
│         Human Space                  │   │         Agent Space                   │
│                                      │   │                                      │
│  WHO: Human leads, PA assists        │   │  WHO: PA leads, Human advises        │
│  HOW: Traditional web UI             │   │  HOW: Game engine + NPC dialogue     │
│  WHAT: Forms, dashboards, lists      │   │  WHAT: Scenes, turns, conversations  │
│                                      │   │                                      │
│  Output = "yours"                    │   │  Output = "PA's draft"               │
│  (confirmed actions, final reviews)  │   │  (explorations, draft feedback)      │
│                                      │   │                                      │
│  Entry: /portal                      │   │  Entry: /lobby                       │
│  Auth: OAuth session (cookie-based)  │   │  Auth: OAuth + GameSession (in-mem)  │
└──────────────┬──────────────────────┘   └──────────────┬──────────────────────┘
               │                                          │
               └──────────── Shared Data ─────────────────┘
                     (PostgreSQL via Prisma)
```

### 2.1 Human Space

Traditional web application. Pages render server-side or client-side React components. Users interact through forms, buttons, and navigation links.

| Characteristic | Detail |
|:---|:---|
| Architecture style | Next.js App Router pages + API routes |
| State management | Server state via API fetch; no persistent session beyond auth cookie |
| PA's role | Assistant — helps fill forms, drafts reviews, suggests content |
| Content authority | Human confirms = final. PA drafts are proposals until confirmed. |

### 2.2 Agent Space

Game-engine-driven conversational environment. The GM engine manages sessions, scenes, NPC AI, and a 4-stage game loop. Documented in `system-architecture-overview.md` (L0-L3 layers).

| Characteristic | Detail |
|:---|:---|
| Architecture style | 4-stage game loop + three-layer ontology + spec-driven scenes/NPCs |
| State management | In-memory `GameSession` with TTL; no DB persistence for session state |
| PA's role | Protagonist — explores scenes, talks to NPCs, makes decisions |
| Content authority | PA produces drafts. Reports (e.g. `gm_report`) are preliminary until human confirms in Human Space. |

## 3. Shared Data Layer

Both spaces read and write the same PostgreSQL database. The `source` field on shared tables distinguishes origin.

### 3.1 AppFeedback — Primary Shared Table

`AppFeedback` is the central data object that both spaces produce and consume.

| Source value | Written by | Space | Meaning |
|:---|:---|:---|:---|
| `gm_report` | `fc.saveReport` in handler-registry | Agent | PA submitted experience report via NPC dialogue |
| `pa_action` | `POST /api/pa-action/review` | Human | Human confirmed (possibly edited) PA-drafted review |
| `human_comment` | `POST /api/feedback` | Human | Human wrote feedback directly |
| `direct_api` | `POST /api/agent/feedback` | External | External agent submitted feedback via API |

**Read paths**: `GET /api/my-reviews` returns all feedbacks by `agentId` regardless of source. The UI shows a badge distinguishing "PA draft" vs "confirmed".

### 3.2 Other Shared Tables

| Table | Agent Space writes? | Human Space writes? | Notes |
|:---|:---|:---|:---|
| `App` | Yes (via SubFlow register) | Yes (via `/api/developer/apps`) | Both paths create apps; `clientId` uniqueness prevents duplicates |
| `User` | Yes (profile SubFlow) | Yes (via `/api/developer/register`, `/api/developer/profile`) | Shared identity |
| `GameSessionLog`, `GameTurnLog` | Yes (event logger) | Read-only (via `/api/pa-activity`) | Agent Space produces; Human Space reads for PA activity display |

### 3.3 Human-Space-Only Tables

These tables have no Agent Space writer:

| Domain | Tables |
|:---|:---|
| Gamification | `PointTransaction`, `DailyTaskProgress`, `AchievementUnlock`, `HallOfFameEntry`, `Season` |
| Community | `AppPost`, `AppComment`, `Vote` |
| PA Directory | `PAVisitor`, `PAQuestion` |
| Practices | `DeveloperPractice` |
| PA Actions | `PAActionLog` |

## 4. Side-Effect Alignment Principle

**Rule**: When the same business action occurs in both spaces, both paths must produce equivalent side effects.

**Current gap** (to be fixed):

| Action | Agent Space path | Human Space path | Gap |
|:---|:---|:---|:---|
| Submit app review | `fc.saveReport` → `AppFeedback` | `pa-action/review` → `AppFeedback` + Points + Achievement + DailyTask + PAActionLog | Agent Space skips gamification |

**Target state**: Both paths call a shared `rewardReview()` function that encapsulates the full side-effect chain: create feedback record, add points, process achievements, increment daily task, log PA action.

This principle applies to any future actions that exist in both spaces. When adding a new dual-space action, always ask: "does the Agent Space path trigger the same rewards as the Human Space path?"

## 5. Space Switching

Users switch between spaces through navigation. No data migration or state transfer is required — both spaces read from the same DB.

| From | To | Mechanism | What happens |
|:---|:---|:---|:---|
| Human Space | Agent Space | Click "进入 Agent Space" on `/portal` | Opens `/lobby`; creates or resumes GameSession |
| Agent Space | Human Space | Click header nav links | Opens target Human Space page; GameSession remains in background (TTL-based expiry) |

### 5.1 Content Handoff: Agent → Human

When PA produces content in Agent Space, it becomes visible in Human Space as a draft:

```text
Agent Space: PA submits experience report via NPC dialogue
  → fc.saveReport writes AppFeedback (source: gm_report)
  → Human opens /my-reviews
  → Sees PA draft with "PA 初稿" badge
  → Can edit and confirm → source becomes human_edited
```

### 5.2 Content Handoff: Human → Agent

Human Space actions can influence Agent Space behavior:

```text
Human Space: Developer registers app via /register form
  → App record created in DB
  → Next time PA enters news scene in Agent Space
  → dataLoader fetches updated app list
  → NPC recommends the new app to PA
```

## 6. Architecture Comparison

| Dimension | Agent Space | Human Space |
|:---|:---|:---|
| Design docs | 10+ (D1-D3 hierarchy) | `human-space-domain-map.md` + this doc |
| Low-code coverage | ~80% (YAML specs, JSON ontologies) | 0% (all handwritten) |
| Domain structure | Engine modules (`lib/engine/`, `lib/npc/`, `lib/scenes/`) | 6 domains in `lib/` (see domain map) |
| API pattern | Single entry point (`POST /api/gm/process`) | ~35 independent API routes |
| State model | In-memory GameSession | Stateless (auth cookie + DB) |
| Type contracts | DualText, MessageEnvelope, TurnResponse, etc. | Per-route ad-hoc response shapes |

## 7. Design Decisions

| Decision | Choice | Rationale |
|:---|:---|:---|
| Separate spaces | Two distinct UIs, not tabs within one | Interaction rhythms are fundamentally different; mixing creates UX confusion |
| Shared DB | Single PostgreSQL instance | Simplicity; both spaces need the same business data |
| Source tagging | `source` field on AppFeedback | Tracks provenance without separate tables; UI can filter/badge by source |
| No session sharing | GameSession is Agent-Space-only | Human Space is stateless by design; no reason to maintain game state for form interactions |
| Content authority | Human Space is authoritative | PA outputs are drafts; human confirmation in Human Space is the "save" action |

## 8. Relationship to Other Docs

| Document | Relationship |
|:---|:---|
| [system-architecture-overview.md](system-architecture-overview.md) | Describes L0-L3 layers of Agent Space only. This doc adds the Human Space dimension. |
| [product-narrative.md](product-narrative.md) | Product-facing description of dual spaces. This doc is the technical architecture. |
| [human-space-domain-map.md](human-space-domain-map.md) | Detailed domain breakdown, API contracts, and file inventory for Human Space. |
| [game-loop-architecture.md](game-loop-architecture.md) | Agent Space internal architecture (L3 detail). |
| [gm-orchestration-architecture.md](gm-orchestration-architecture.md) | Agent Space orchestration layer. |
