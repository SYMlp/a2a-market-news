'use client'

import type { RefObject } from 'react'
import { useTranslations } from 'next-intl'
import { SCENE_CONFIG, getSceneLayout } from '@/lib/scene-visuals'
import type { SceneVisualConfig, TransitionAnimation } from '@/lib/scene-visuals'
import type { ComponentSpec } from '@/lib/component-runtime/types'
import type { GameMode } from '@/components/scene/TownApproach'
import type { ChatMessage } from '@/components/scene/ChatHistory'
import type { SpecFormCardStatus } from '@/components/scene/SpecFormCard'
import SceneShell from '@/components/scene/SceneShell'
import NavigationHUD from '@/components/scene/NavigationHUD'
import CharacterStage from '@/components/scene/CharacterStage'
import SceneAppDock from '@/components/scene/SceneAppDock'
import HoloActionPanel from '@/components/scene/HoloActionPanel'
import SceneTransitionEngine from '@/components/scene/SceneTransitionEngine'
import ChatHistory from '@/components/scene/ChatHistory'
import SpecFormCard from '@/components/scene/SpecFormCard'
import FeedbackPanel, { FeedbackBadge } from '@/components/scene/FeedbackPanel'
import SpaceMiniWindow from '@/components/scene/SpaceMiniWindow'

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
  const t = useTranslations('agentSpace')
  const showManualActions = phase === 'conversation' && mode === 'manual'
  const showAdvisorInput = phase === 'conversation' && mode === 'advisor'
  const showAutoControls = phase === 'conversation' && mode === 'auto'

  const layout = getSceneLayout(scene)
  const dockHintTr =
    scene === 'lobby'
      ? t('dockHints.lobby')
      : scene === 'news'
        ? t('dockHints.news')
        : scene === 'developer'
          ? t('dockHints.developer')
          : layout.dockBubbleHint
  const dockTitleTr =
    scene === 'lobby'
      ? t('dockTitles.lobby')
      : scene === 'news'
        ? t('dockTitles.news')
        : scene === 'developer'
          ? t('dockTitles.developer')
          : layout.appDockTitle
  const showCardDock = phase === 'conversation'
    && !subFlowCard
    && behaviorPresentation?.style === 'card_deck'
    && Array.isArray(behaviorPresentation.data)
    && behaviorPresentation.data.length > 0

  const dockSource = showCardDock ? behaviorPresentation.data : []
  const dockItems = dockSource.slice(0, layout.maxAppDockItems)

  const npcBubbleForStage = (() => {
    if (!npcBubble) return null
    if (!showCardDock || !layout.shortNpcBubbleWhenDock) return npcBubble
    const max = layout.npcBubbleMaxChars
    if (npcBubble.length <= max) return npcBubble
    return `${npcBubble.slice(0, max).trim()}…\n${dockHintTr}`
  })()

  return (
    <SceneShell
      scene={scene}
      accentRgb={cfg.accentRgb}
      particleCount={cfg.bgParticleCount}
      plaque={phase === 'conversation'
        ? {
            label:
              scene === 'lobby'
                ? t('scenes.lobby.label')
                : scene === 'news'
                  ? t('scenes.news.label')
                  : scene === 'developer'
                    ? t('scenes.developer.label')
                    : cfg.label,
            icon: cfg.icon,
            npcName:
              scene === 'lobby'
                ? t('scenes.lobby.agentName')
                : scene === 'news'
                  ? t('scenes.news.agentName')
                  : scene === 'developer'
                    ? t('scenes.developer.agentName')
                    : cfg.agentName,
          }
        : null}
      dockActive={showCardDock}
    >
      {phase === 'entering' && (
        <div className="scene-tr-v2">
          <div className="scene-tr-v2__content">
            <div className="scene-tr-v2__icon">🚪</div>
            <div className="scene-tr-v2__label">{t('conversation.enteringTitle')}</div>
            <div className="scene-tr-v2__sub">{t('conversation.enteringSub')}</div>
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
        npcName={
          scene === 'lobby'
            ? t('scenes.lobby.agentName')
            : scene === 'news'
              ? t('scenes.news.agentName')
              : scene === 'developer'
                ? t('scenes.developer.agentName')
                : cfg.agentName
        }
        paName={paName}
        accentRgb={cfg.accentRgb}
        npcBubble={npcBubbleForStage}
        paBubble={paBubble}
        paState={paState}
        npcState={npcState}
      />

      {showCardDock && behaviorPresentation && (
        <SceneAppDock
          title={dockTitleTr}
          accentRgb={cfg.accentRgb}
          data={dockItems}
          card={behaviorPresentation.card as { title: string; subtitle?: string } | undefined}
          animation={behaviorPresentation.animation as { enter?: string; idle?: string } | undefined}
          totalSourceCount={dockSource.length}
          maxSlots={layout.maxAppDockItems}
        />
      )}

      {transition?.active && (
        <SceneTransitionEngine
          active
          type={transition.type}
          from={transition.from}
          to={transition.to}
          toIcon={(SCENE_CONFIG[transition.to] || SCENE_CONFIG.lobby).agentEmoji}
          toLabel={
            transition.to === 'lobby'
              ? t('scenes.lobby.label')
              : transition.to === 'news'
                ? t('scenes.news.label')
                : transition.to === 'developer'
                  ? t('scenes.developer.label')
                  : (SCENE_CONFIG[transition.to] || SCENE_CONFIG.lobby).label
          }
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
                {t('conversation.loadingSpec')}
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
              {t('conversation.advisorHint')}
            </div>
            <div className="advisor-input__row">
              <input
                ref={adviceInputRef}
                className="advisor-input__field"
                type="text"
                value={adviceInput}
                onChange={(e) => onAdviceInputChange(e.target.value)}
                placeholder={t('conversation.advisorPlaceholder')}
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
            <span className="holo-actions__card-label">{paused ? t('conversation.resumeChat') : t('conversation.pauseChat')}</span>
          </button>
        </div>
      )}

      {phase === 'conversation' && (
        <ChatHistory messages={chatLog} accentRgb={cfg.accentRgb} isTyping={processing} typingNpcName={cfg.agentName} />
      )}

      {phase === 'conversation' && (
        <SpaceMiniWindow variant="human-in-agent" />
      )}
    </SceneShell>
  )
}
