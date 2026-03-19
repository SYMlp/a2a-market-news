'use client'

import type { RefObject } from 'react'
import { SCENE_CONFIG } from '@/lib/scene-visuals'
import type { SceneVisualConfig, TransitionAnimation } from '@/lib/scene-visuals'
import type { ComponentSpec } from '@/lib/component-runtime/types'
import type { GameMode } from '@/components/scene/TownApproach'
import type { ChatMessage } from '@/components/scene/ChatHistory'
import type { SpecFormCardStatus } from '@/components/scene/SpecFormCard'
import SceneShell from '@/components/scene/SceneShell'
import NavigationHUD from '@/components/scene/NavigationHUD'
import CharacterStage from '@/components/scene/CharacterStage'
import HoloActionPanel from '@/components/scene/HoloActionPanel'
import SceneTransitionEngine from '@/components/scene/SceneTransitionEngine'
import ChatHistory from '@/components/scene/ChatHistory'
import SpecFormCard from '@/components/scene/SpecFormCard'
import FeedbackPanel, { FeedbackBadge } from '@/components/scene/FeedbackPanel'
import DeckView from '@/components/scene/DeckView'

interface ActionOption {
  id: string
  label: string
  icon?: string
  outcome?: 'stay' | 'move'
}

type Phase = 'approach' | 'entering' | 'conversation' | 'transitioning' | 'farewell'

export interface BehaviorPresentationPayload {
  style: string
  data: unknown[]
  card?: unknown
  animation?: unknown
}

export interface ConversationViewProps {
  scene: string
  cfg: SceneVisualConfig
  phase: Phase
  mode: GameMode | null
  paName: string

  npcBubble: string | null
  paBubble: string | null
  paState: 'idle' | 'walking' | 'thinking'
  npcState: 'idle' | 'thinking'

  transition: {
    active: boolean
    type: TransitionAnimation
    from: string
    to: string
  } | null

  subFlowCard: { type: string; args: Record<string, unknown> } | null
  subFlowCardStatus: SpecFormCardStatus
  specsCache: Record<string, ComponentSpec> | null
  behaviorPresentation: BehaviorPresentationPayload | null

  adviceInput: string
  processing: boolean
  paused: boolean
  chatLog: ChatMessage[]
  actions: ActionOption[]
  sceneData: Record<string, unknown> | null
  feedbackPanelOpen: boolean

  adviceInputRef: RefObject<HTMLInputElement | null>

  onNavigate: (targetScene: string) => void
  onBack: () => void
  onModeToggle: () => void
  onTransitionComplete: () => void
  onSubFlowConfirm: (args: Record<string, unknown>) => void
  onSubFlowCancel: () => void
  onAdvisorSubmit: (advice: string) => void
  onAction: (text: string) => void
  onFeedbackOpen: () => void
  onFeedbackClose: () => void
  onAdviceInputChange: (value: string) => void
  onPauseToggle: () => void
}

export default function ConversationView({
  scene, cfg, phase, mode, paName,
  npcBubble, paBubble, paState, npcState,
  transition,
  subFlowCard, subFlowCardStatus, specsCache, behaviorPresentation,
  adviceInput, processing, paused,
  chatLog, actions, sceneData, feedbackPanelOpen,
  adviceInputRef,
  onNavigate, onBack, onModeToggle, onTransitionComplete,
  onSubFlowConfirm, onSubFlowCancel, onAdvisorSubmit, onAction,
  onFeedbackOpen, onFeedbackClose, onAdviceInputChange, onPauseToggle,
}: ConversationViewProps) {
  const showManualActions = phase === 'conversation' && mode === 'manual'
  const showAdvisorInput = phase === 'conversation' && mode === 'advisor'
  const showAutoControls = phase === 'conversation' && mode === 'auto'

  return (
    <SceneShell scene={scene} accentRgb={cfg.accentRgb} particleCount={cfg.bgParticleCount}>
      {phase === 'entering' && (
        <div className="scene-tr-v2">
          <div className="scene-tr-v2__content">
            <div className="scene-tr-v2__icon">🚪</div>
            <div className="scene-tr-v2__label">进入报社</div>
            <div className="scene-tr-v2__sub">ENTERING</div>
            <div className="scene-tr-v2__bar">
              <div className="scene-tr-v2__bar-fill" />
            </div>
          </div>
        </div>
      )}

      <NavigationHUD
        currentScene={scene}
        mode={mode}
        onNavigate={onNavigate}
        onBack={onBack}
        onModeToggle={onModeToggle}
        canGoBack={scene !== 'lobby' && phase === 'conversation'}
      />

      {scene === 'developer' && phase === 'conversation' && (
        <FeedbackBadge
          count={typeof sceneData?.feedbackCount === 'number' ? sceneData.feedbackCount : 0}
          accentRgb={cfg.accentRgb}
          onClick={onFeedbackOpen}
        />
      )}

      <FeedbackPanel
        feedbacks={Array.isArray(sceneData?.feedbacks) ? (sceneData.feedbacks as never[]) : []}
        feedbackCount={typeof sceneData?.feedbackCount === 'number' ? sceneData.feedbackCount : 0}
        accentRgb={cfg.accentRgb}
        open={feedbackPanelOpen}
        onClose={onFeedbackClose}
      />

      <CharacterStage
        npcName={cfg.agentName}
        paName={paName}
        accentRgb={cfg.accentRgb}
        npcBubble={npcBubble}
        paBubble={paBubble}
        paState={paState}
        npcState={npcState}
        npcBubbleSlot={
          behaviorPresentation && !subFlowCard && phase === 'conversation'
            && behaviorPresentation.style === 'card_deck'
            ? <DeckView
                data={behaviorPresentation.data}
                card={behaviorPresentation.card as { title: string; subtitle?: string } | undefined}
                animation={behaviorPresentation.animation as { enter?: string; idle?: string } | undefined}
                accentRgb={cfg.accentRgb}
              />
            : undefined
        }
      />

      {transition?.active && (
        <SceneTransitionEngine
          active
          type={transition.type}
          from={transition.from}
          to={transition.to}
          toIcon={(SCENE_CONFIG[transition.to] || SCENE_CONFIG.lobby).agentEmoji}
          toLabel={(SCENE_CONFIG[transition.to] || SCENE_CONFIG.lobby).label}
          accentRgb={(SCENE_CONFIG[transition.to] || SCENE_CONFIG.lobby).accentRgb}
          onComplete={onTransitionComplete}
        />
      )}

      {subFlowCard && phase === 'conversation' && (
        <div className="holo-actions" style={{ paddingTop: 0 }}>
          <div style={{ maxWidth: 380, margin: '0 auto' }}>
            {specsCache?.[subFlowCard.type] ? (
              <SpecFormCard
                spec={specsCache[subFlowCard.type]}
                args={subFlowCard.args}
                status={subFlowCardStatus}
                accentRgb={cfg.accentRgb}
                onConfirm={(a) => onSubFlowConfirm(a)}
                onCancel={onSubFlowCancel}
              />
            ) : (
              <div
                className="register-card rounded-2xl border border-white/20 px-4 py-6 text-center text-white/50 text-sm"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(0,0,0,0.4))',
                }}
              >
                加载中…
              </div>
            )}
          </div>
        </div>
      )}


      {showAdvisorInput && !subFlowCard && (
        <div className="holo-actions" style={{ paddingTop: 0 }}>
          <form
            className="advisor-input"
            onSubmit={(e) => {
              e.preventDefault()
              onAdvisorSubmit(adviceInput)
            }}
          >
            <div className="advisor-input__hint">
              💬 悄悄告诉你的 PA...
            </div>
            <div className="advisor-input__row">
              <input
                ref={adviceInputRef}
                className="advisor-input__field"
                type="text"
                value={adviceInput}
                onChange={(e) => onAdviceInputChange(e.target.value)}
                placeholder="例如：去日报栏看看吧"
                disabled={processing}
                autoFocus
              />
              <button
                className="advisor-input__send"
                type="submit"
                disabled={processing || !adviceInput.trim()}
              >
                {processing ? '...' : '→'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showManualActions && !subFlowCard && (
        <HoloActionPanel
          actions={actions}
          onAction={onAction}
          onFreeInput={onAction}
          disabled={processing}
        />
      )}

      {showAutoControls && !subFlowCard && (
        <div className="holo-actions" style={{ paddingTop: 0 }}>
          <button
            className="holo-actions__card"
            onClick={onPauseToggle}
            style={{ opacity: 1, transform: 'none', animation: 'none' }}
          >
            <span className="holo-actions__card-icon">{paused ? '▶' : '⏸'}</span>
            <span className="holo-actions__card-label">{paused ? '继续对话' : '暂停对话'}</span>
          </button>
        </div>
      )}

      {phase === 'conversation' && (
        <ChatHistory messages={chatLog} accentRgb={cfg.accentRgb} isTyping={processing} typingNpcName={cfg.agentName} />
      )}
    </SceneShell>
  )
}
