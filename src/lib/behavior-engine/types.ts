/**
 * Behavior Engine — Core Types
 *
 * Architecture: docs/behavior-spec-architecture.md
 * Plan: behavior_engine plan §P0
 *
 * BehaviorSpec mirrors the YAML format: availability, cognition,
 * presentation, resolution. Each section is a first-class peer.
 */

import type { DualText, GameSession } from '../engine/types'

// ─── Resolution Type ─────────────────────────────

export type ResolutionType = 'select_one' | 'subflow' | 'free_response' | 'navigate'

// ─── BehaviorSpec (YAML-parsed structure) ────────

export interface BehaviorTrigger {
  onSceneEnter?: boolean
  onFunctionCall?: string
}

export interface BehaviorAvailability {
  scenes: string[]
  implements?: string
  trigger: BehaviorTrigger
  preconditions?: string[]
}

export interface BehaviorCognition {
  forPA?: string
  forNPC?: string
  forClassifier?: string
}

export interface BehaviorPresentationData {
  dataLoader: string
  field: string
  itemKey: string
}

export interface BehaviorCardTemplate {
  title: string
  subtitle?: string
}

export interface BehaviorAnimation {
  enter?: string
  idle?: string
}

export interface BehaviorPresentation {
  style: string
  data?: BehaviorPresentationData
  card?: BehaviorCardTemplate
  animation?: BehaviorAnimation
}

export interface BehaviorResolutionMapsTo {
  action: string
  fc: string
}

export interface BehaviorResolution {
  type: ResolutionType
  interceptsMessages?: boolean
  mapsTo?: BehaviorResolutionMapsTo
  params?: Record<string, string>
}

export interface BehaviorSpec {
  id: string
  description?: string
  availability: BehaviorAvailability
  cognition?: BehaviorCognition
  presentation?: BehaviorPresentation
  resolution: BehaviorResolution
}

// ─── Runtime Types ───────────────────────────────

export interface CognitionContext {
  forPA?: string
  forNPC?: string
  forClassifier?: string
}

export interface PresentationData {
  style: string
  data: unknown[]
  spec: BehaviorSpec
}

/**
 * Returned by strategy handlers when a behavior intercepts the message.
 * The route handler wraps this into a full API response.
 */
export interface BehaviorResult {
  message: DualText
  presentation?: PresentationData
  data?: Record<string, unknown>
}

/**
 * Stored in session.flags.activeBehavior to track the currently active behavior.
 */
export interface ActiveBehavior {
  specId: string
  type: ResolutionType
  state: Record<string, unknown>
  activatedAt: number
}

// ─── User context (matches existing SubFlowHandler signature) ───

export interface BehaviorUserContext {
  id: string
  name: string | null
}
