'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { SCENE_CONFIG } from '@/lib/scene-visuals'
import type { TransitionAnimation } from '@/lib/scene-visuals/types'
import type { Scene } from '@/lib/engine/types'
import { useAutoLoop } from '@/hooks/useAutoLoop'
import { useSubFlowCard } from '@/hooks/useSubFlowCard'
import { useGameSession } from '@/hooks/useGameSession'
import TownApproach from '@/components/scene/TownApproach'
import type { GameMode } from '@/components/scene/TownApproach'
import TownFarewell from '@/components/scene/TownFarewell'
import ConversationView from '@/components/scene/ConversationView'

interface ActionOption {
  id: string
  label: string
  icon?: string
  outcome?: 'stay' | 'move'
}

const ACTION_ICONS: Record<string, string> = {
  go_news: '📰', go_developer: '🛠️',
  experience: '🎮', report: '📝',
  manage_apps: '📦', view_feedback: '💬', register_app: '➕',
  edit_app: '✏️', app_lifecycle: '⏸️', edit_profile: '👤',
  back_lobby: '🏛️',
}

const MODE_ORDER: GameMode[] = ['advisor', 'auto', 'manual']

function delay(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms))
}

function getSceneActions(
  scenes: Record<string, Scene>,
  sceneId: string,
  preconditionState?: Record<string, boolean>,
): ActionOption[] {
  const scene = scenes[sceneId]
  if (!scene) return []
  return scene.actions
    .filter(a => {
      if (!a.precondition) return true
      const check = a.precondition.check
      if (preconditionState && check in preconditionState) return preconditionState[check]
      return true
    })
    .map(a => ({
      id: a.id,
      label: a.label.pa,
      icon: ACTION_ICONS[a.id],
      outcome: a.outcome,
    }))
}

interface LobbyClientProps {
  scenes: Record<string, Scene>
}

export default function LobbyClient({ scenes }: LobbyClientProps) {
  const t = useTranslations('agentSpace')
  const {
    user, cfg,
    phase, setPhase,
    mode, setMode,
    scene, setScene,
    processing, setProcessing,
    npcBubble, setNpcBubble,
    paBubble, setPaBubble,
    paState, setPaState,
    npcState, setNpcState,
    chatLog,
    paused, setPaused,
    adviceInput, setAdviceInput,
    specsCache,
    sessionSummary,
    sceneData, setSceneData,
    preconditions, setPreconditions,
    feedbackPanelOpen, setFeedbackPanelOpen,
    behaviorPresentation, setBehaviorPresentation,
    transition, setTransition,
    pausedRef,
    sessionRef,
    lastAgentMsgRef,
    sceneRef,
    transitionResolveRef,
    adviceInputRef,
    sessionCleanupRef,
    appendChat,
    handleFarewellComplete,
    enterSceneApi,
    sendMessageApi,
    paRespondApi,
    subFlowConfirmApi,
  } = useGameSession()

  // ─── SubFlow card hook ───

  const {
    subFlowCard, subFlowCardStatus,
    checkForSubFlowCard, handleSubFlowConfirm, handleSubFlowCancel,
    resetSubFlowCard,
  } = useSubFlowCard({
    subFlowConfirmApi, appendChat, mode,
    sessionRef, sceneRef, setNpcBubble, lastAgentMsgRef,
  })

  // ─── Mode selection (from TownApproach) ───

  const handleModeSelect = useCallback(async (m: GameMode) => {
    setMode(m)
    setPhase('entering')
    setProcessing(true)

    await delay(900)

    const result = await enterSceneApi('lobby', m)
    const npcText = result?.message?.pa || cfg.npcGreeting
    setNpcBubble(npcText)
    lastAgentMsgRef.current = npcText
    appendChat('npc', cfg.agentName, npcText)
    if (result?.data) setSceneData(result.data as Record<string, unknown>)
    if (result?.preconditionState) setPreconditions(result.preconditionState)

    setPhase('conversation')
    setProcessing(false)
  }, [
    enterSceneApi, cfg.npcGreeting, cfg.agentName, appendChat,
    lastAgentMsgRef, setMode, setNpcBubble, setPhase, setPreconditions, setProcessing, setSceneData,
  ])

  // ─── Scene transition ───

  const handleTransitionComplete = useCallback(async () => {
    const tr = transition
    if (!tr) return
    setTransition(null)
    setScene(tr.to)

    setNpcState('thinking')
    const result = await enterSceneApi(tr.to, mode!)
    setNpcState('idle')
    if (result) {
      const toCfg = SCENE_CONFIG[tr.to] || SCENE_CONFIG.lobby
      setNpcBubble(result.message.pa)
      lastAgentMsgRef.current = result.message.pa
      appendChat('npc', toCfg.agentName, result.message.pa)
      if (result.data) setSceneData(result.data as Record<string, unknown>)
      if (result.preconditionState) setPreconditions(result.preconditionState)
    }

    setPhase('conversation')
    transitionResolveRef.current?.()
    transitionResolveRef.current = null
  }, [
    transition, mode, enterSceneApi, appendChat,
    lastAgentMsgRef, setNpcBubble, setNpcState, setPhase, setPreconditions, setScene, setSceneData, setTransition, transitionResolveRef,
  ])

  const handleSceneTransition = async (tr: { from: string; to: string }) => {
    setPhase('transitioning')
    autoLoopRef.current = false
    setNpcBubble(null)
    setPaBubble(null)
    resetSubFlowCard()
    setSceneData(null)
    setPreconditions({})
    setFeedbackPanelOpen(false)
    setBehaviorPresentation(null)

    const fromCfg = SCENE_CONFIG[tr.from] || SCENE_CONFIG.lobby
    const toCfg = SCENE_CONFIG[tr.to] || SCENE_CONFIG.lobby
    const trType: TransitionAnimation = fromCfg.transitionOut || toCfg.transitionIn || 'fade'

    setTransition({ active: true, type: trType, from: tr.from, to: tr.to })

    await new Promise<void>(resolve => {
      transitionResolveRef.current = resolve
    })
  }

  // ─── Navigation ───

  const handleNavigate = (targetScene: string) => {
    if (targetScene === scene || phase === 'transitioning') return
    handleSceneTransition({ from: scene, to: targetScene })
  }

  const handleBack = () => {
    if (scene !== 'lobby') {
      handleSceneTransition({ from: scene, to: 'lobby' })
    }
  }

  const handleModeToggle = () => {
    if (!mode) return
    const idx = MODE_ORDER.indexOf(mode)
    const next = MODE_ORDER[(idx + 1) % MODE_ORDER.length]
    setMode(next)
    autoLoopRef.current = false
    setPaused(false)
    pausedRef.current = false
    autoRetryCount.current = 0
    recentNpcMsgsRef.current = []
    setNpcState('idle')
    setAdviceInput('')
  }

  // ─── Chain Stage 0+1: shared PA formulation + intent → GM → NPC ───

  const runFormulateAndSend = useCallback(async (humanAdvice?: string) => {
    const currentCfg = SCENE_CONFIG[sceneRef.current] || SCENE_CONFIG.lobby
    const paLabel = user?.name || 'My PA'

    const paResult = await paRespondApi(
      lastAgentMsgRef.current,
      [],
      humanAdvice,
    )
    if (!paResult?.success) {
      const thinking = t('lobbyClient.paThinking')
      setPaBubble(thinking)
      setPaState('idle')
      appendChat('pa', paLabel, thinking)
      return { type: 'error' as const, reason: 'pa respond failed' }
    }

    const paResponse = paResult.paResponse || t('lobbyClient.paThinking')
    setPaBubble(paResponse)
    setPaState('idle')
    appendChat('pa', paLabel, paResponse)

    const speakDelay = Math.min(paResponse.length * 28, 2000) + 400
    await delay(speakDelay)

    setNpcState('thinking')
    const gmResult = await sendMessageApi(paResponse, humanAdvice)
    setNpcState('idle')
    if (!gmResult?.success) return { type: 'error' as const, reason: 'send message failed' }

    if (checkForSubFlowCard(gmResult)) {
      const npcMessage = gmResult.message?.pa ?? ''
      setNpcBubble(npcMessage)
      lastAgentMsgRef.current = npcMessage
      if (npcMessage) appendChat('npc', currentCfg.agentName, npcMessage)
      return { type: 'continue' as const }
    }

    if (gmResult.sceneTransition) {
      const farewellText = gmResult.message?.pa || ''
      setNpcBubble(farewellText)
      lastAgentMsgRef.current = farewellText
      if (farewellText) appendChat('npc', currentCfg.agentName, farewellText)
      const farewellDelay = Math.max(1500, Math.min(farewellText.length * 50, 2500))
      await delay(farewellDelay)
      return { type: 'transition' as const, transition: gmResult.sceneTransition }
    }

    const npcMessage = gmResult.message?.pa ?? ''
    setNpcBubble(npcMessage)
    lastAgentMsgRef.current = npcMessage
    if (npcMessage) appendChat('npc', currentCfg.agentName, npcMessage)
    return { type: 'continue' as const }
  }, [
    paRespondApi, sendMessageApi, user?.name, appendChat, checkForSubFlowCard,
    lastAgentMsgRef, sceneRef, setNpcBubble, setNpcState, setPaBubble, setPaState,
    t,
  ])

  // ─── Advisor mode: human gives advice → PA formulates → GM/NPC ───

  const handleAdvisorSubmit = async (advice: string) => {
    if (processing || !advice.trim()) return
    setProcessing(true)
    setNpcBubble(null)
    setPaState('thinking')
    setAdviceInput('')
    appendChat('system', t('lobbyClient.systemYou'), `💬 ${advice.trim()}`)

    const result = await runFormulateAndSend(advice.trim())

    if (result.type === 'transition') {
      setProcessing(false)
      await handleSceneTransition(result.transition)
      return
    }

    setPaState('idle')
    setProcessing(false)
  }

  // ─── Manual-direct mode: user picks action → text to GM ───

  const handleAction = async (text: string) => {
    if (processing) return
    setProcessing(true)
    setNpcBubble(null)

    const paLabel = user?.name || 'My PA'
    const currentCfg = SCENE_CONFIG[sceneRef.current] || SCENE_CONFIG.lobby

    setPaState('idle')
    setPaBubble(text)
    appendChat('pa', paLabel, text)
    const speakDelay = Math.min(text.length * 40, 2000) + 300
    await delay(speakDelay)

    setNpcState('thinking')
    const result = await sendMessageApi(text)

    setNpcState('idle')

    if (result) {
      setNpcBubble(result.message.pa)
      lastAgentMsgRef.current = result.message.pa
      if (result.message.pa) appendChat('npc', currentCfg.agentName, result.message.pa)

      if (checkForSubFlowCard(result)) {
        setProcessing(false)
        return
      }

      if (result.sceneTransition) {
        const farewellText = result.message.pa || ''
        const farewellDelay = Math.max(1500, Math.min(farewellText.length * 50, 2500))
        await delay(farewellDelay)
        setProcessing(false)
        await handleSceneTransition(result.sceneTransition)
        return
      }
    }
    setProcessing(false)
  }

  // ─── Auto mode loop ───

  const { autoLoopRef, autoRetryCount, recentNpcMsgsRef } = useAutoLoop({
    mode, phase, processing, setProcessing,
    paused, setPaused, pausedRef,
    npcBubble,
    lastAgentMsgRef, sceneRef,
    userName: user?.name || 'My PA',
    appendChat,
    paRespondApi, sendMessageApi, handleSceneTransition,
    setPaState, setNpcState, setNpcBubble, setPaBubble,
  })

  sessionCleanupRef.current = () => {
    autoLoopRef.current = false
    autoRetryCount.current = 0
    recentNpcMsgsRef.current = []
  }

  // ─── Render ───

  const actions = getSceneActions(scenes, scene, preconditions)
  const paName = user?.name || 'My PA'

  const handlePauseToggle = useCallback(() => {
    setPaused(!paused)
    pausedRef.current = !paused
  }, [paused, pausedRef, setPaused])

  if (phase === 'approach') {
    return <TownApproach onModeSelect={handleModeSelect} paName={paName} />
  }

  if (phase === 'farewell' && sessionSummary) {
    return (
      <TownFarewell
        summary={sessionSummary}
        paName={paName}
        onComplete={handleFarewellComplete}
      />
    )
  }

  return (
    <ConversationView
      scene={scene}
      cfg={cfg}
      phase={phase}
      mode={mode}
      paName={paName}
      npcBubble={npcBubble}
      paBubble={paBubble}
      paState={paState}
      npcState={npcState}
      transition={transition}
      subFlowCard={subFlowCard}
      subFlowCardStatus={subFlowCardStatus}
      specsCache={specsCache}
      behaviorPresentation={behaviorPresentation}
      adviceInput={adviceInput}
      processing={processing}
      paused={paused}
      chatLog={chatLog}
      actions={actions}
      sceneData={sceneData}
      feedbackPanelOpen={feedbackPanelOpen}
      adviceInputRef={adviceInputRef}
      onNavigate={handleNavigate}
      onBack={handleBack}
      onModeToggle={handleModeToggle}
      onTransitionComplete={handleTransitionComplete}
      onSubFlowConfirm={handleSubFlowConfirm}
      onSubFlowCancel={handleSubFlowCancel}
      onAdvisorSubmit={handleAdvisorSubmit}
      onAction={handleAction}
      onFeedbackOpen={() => setFeedbackPanelOpen(true)}
      onFeedbackClose={() => setFeedbackPanelOpen(false)}
      onAdviceInputChange={setAdviceInput}
      onPauseToggle={handlePauseToggle}
    />
  )
}
