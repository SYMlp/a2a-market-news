'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { SCENE_CONFIG } from '@/lib/scene-visuals'
import type { TransitionAnimation } from '@/lib/scene-visuals/types'
import { SCENES } from '@/lib/scenes'
import { runAutoLoopStep } from '@/lib/pa'
import SceneShell from '@/components/scene/SceneShell'
import NavigationHUD from '@/components/scene/NavigationHUD'
import CharacterStage from '@/components/scene/CharacterStage'
import HoloActionPanel from '@/components/scene/HoloActionPanel'
import TownApproach from '@/components/scene/TownApproach'
import type { GameMode } from '@/components/scene/TownApproach'
import TownFarewell from '@/components/scene/TownFarewell'
import type { SessionSummary } from '@/components/scene/TownFarewell'
import SceneTransitionEngine from '@/components/scene/SceneTransitionEngine'
import ChatHistory from '@/components/scene/ChatHistory'
import type { ChatMessage } from '@/components/scene/ChatHistory'
import RegisterCard from '@/components/scene/RegisterCard'
import type { RegisterAppArgs, RegisterCardStatus } from '@/components/scene/RegisterCard'
import AppSettingsCard from '@/components/scene/AppSettingsCard'
import AppLifecycleCard from '@/components/scene/AppLifecycleCard'
import ProfileCard from '@/components/scene/ProfileCard'

const CARD_FC_MAP: Record<string, string> = {
  'GM.registerApp': 'register',
  'GM.updateAppSettings': 'app_settings',
  'GM.updateProfile': 'profile',
  'GM.changeAppStatus': 'app_lifecycle',
}
import { fetchWithTimeout } from '@/lib/fetch-timeout'

type Phase = 'approach' | 'entering' | 'conversation' | 'transitioning' | 'farewell'

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

function getSceneActions(sceneId: string): ActionOption[] {
  const scene = SCENES[sceneId]
  if (!scene) return []
  return scene.actions.map(a => ({
    id: a.id,
    label: a.label.pa,
    icon: ACTION_ICONS[a.id],
    outcome: a.outcome,
  }))
}

export default function LobbyPage() {
  const { user, loading: authLoading } = useAuth()

  const [phase, setPhase] = useState<Phase>('approach')
  const [mode, setMode] = useState<GameMode | null>(null)
  const [scene, setScene] = useState('lobby')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  const [npcBubble, setNpcBubble] = useState<string | null>(null)
  const [paBubble, setPaBubble] = useState<string | null>(null)
  const [paState, setPaState] = useState<'idle' | 'walking' | 'thinking'>('idle')

  const [chatLog, setChatLog] = useState<ChatMessage[]>([])
  const [paused, setPaused] = useState(false)
  const [adviceInput, setAdviceInput] = useState('')
  const [subFlowCard, setSubFlowCard] = useState<{ type: string; args: Record<string, unknown> } | null>(null)
  const [subFlowCardStatus, setSubFlowCardStatus] = useState<RegisterCardStatus>('pending')
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null)
  const [transition, setTransition] = useState<{
    active: boolean
    type: TransitionAnimation
    from: string
    to: string
  } | null>(null)
  const pausedRef = useRef(false)
  pausedRef.current = paused
  const sessionRef = useRef(sessionId)
  sessionRef.current = sessionId
  const autoLoopRef = useRef(false)
  const lastAgentMsgRef = useRef('')
  const sceneRef = useRef(scene)
  sceneRef.current = scene
  const transitionResolveRef = useRef<(() => void) | null>(null)
  const autoRetryCount = useRef(0)
  const AUTO_RETRY_LIMIT = 3
  const recentNpcMsgsRef = useRef<string[]>([])
  const adviceInputRef = useRef<HTMLInputElement>(null)

  const chatIdRef = useRef(0)
  const appendChat = useCallback((role: ChatMessage['role'], name: string, text: string) => {
    if (!text) return
    setChatLog(prev => [...prev, {
      id: String(++chatIdRef.current),
      role,
      name,
      text,
      timestamp: Date.now(),
    }])
  }, [])

  const cfg = SCENE_CONFIG[scene] || SCENE_CONFIG.lobby

  // ─── Auth redirect ───

  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = '/api/auth/login'
    }
  }, [authLoading, user])

  // ─── Session end + farewell ───

  const handleSessionEnd = useCallback((farewellMsg?: string, apiSummary?: {
    scenesVisited?: string[]
    achievements?: Array<{ sceneId: string; actionId: string; label: string; timestamp: number }>
    totalTurns?: number
  }) => {
    autoLoopRef.current = false
    setPaused(true)
    pausedRef.current = true

    if (farewellMsg) {
      const currentCfg = SCENE_CONFIG[sceneRef.current] || SCENE_CONFIG.lobby
      setNpcBubble(farewellMsg)
      appendChat('npc', currentCfg.agentName, farewellMsg)
    }

    const visited = apiSummary?.scenesVisited ?? []
    const npcsMet = visited
      .filter(s => s !== 'lobby')
      .map(s => {
        const c = SCENE_CONFIG[s]
        return { name: c?.agentName || s, emoji: c?.agentEmoji || '👤' }
      })
    const lobbyCfg = SCENE_CONFIG.lobby
    if (lobbyCfg) {
      npcsMet.unshift({ name: lobbyCfg.agentName, emoji: lobbyCfg.agentEmoji })
    }

    const summary: SessionSummary = {
      scenesVisited: visited,
      npcsMet,
      achievements: apiSummary?.achievements ?? [],
      totalTurns: apiSummary?.totalTurns ?? 0,
    }
    setSessionSummary(summary)
    setPhase('farewell')
  }, [appendChat])

  const handleFarewellComplete = useCallback(() => {
    setPhase('approach')
    setMode(null)
    setScene('lobby')
    setSessionId(null)
    sessionRef.current = null
    setChatLog([])
    setNpcBubble(null)
    setPaBubble(null)
    setPaState('idle')
    setPaused(false)
    pausedRef.current = false
    autoRetryCount.current = 0
    recentNpcMsgsRef.current = []
    lastAgentMsgRef.current = ''
    setSessionSummary(null)
  }, [])

  // ─── API helpers ───

  const enterSceneApi = useCallback(async (sceneId: string, m: GameMode) => {
    try {
      const res = await fetchWithTimeout('/api/gm/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enter', sceneId, mode: m, sessionId: sessionRef.current }),
      })
      const json = await res.json()
      if (!json.success) return null
      setSessionId(json.sessionId)
      sessionRef.current = json.sessionId
      if (json.sessionEnded) {
        handleSessionEnd(json.message?.pa, json.summary)
        return null
      }
      return json
    } catch { return null }
  }, [handleSessionEnd])

  const sendMessageApi = useCallback(async (text: string, originalMessage?: string) => {
    try {
      const res = await fetchWithTimeout('/api/gm/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'message',
          message: text,
          sessionId: sessionRef.current,
          mode,
          ...(originalMessage ? { originalMessage } : {}),
        }),
      })
      const json = await res.json()
      if (!json.success) return null
      if (json.sessionEnded) {
        handleSessionEnd(json.message?.pa, json.summary)
        return null
      }
      return json
    } catch { return null }
  }, [mode, handleSessionEnd])

  const paRespondApi = useCallback(async (
    gmMessage: string,
    validIntents?: string[],
    humanAdvice?: string,
  ) => {
    try {
      const res = await fetchWithTimeout('/api/gm/pa-respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gmMessage,
          validIntents: validIntents ?? [],
          sceneId: sceneRef.current,
          sessionId: sessionRef.current,
          ...(humanAdvice ? { humanAdvice } : {}),
        }),
      })
      const json = await res.json()
      if (!json.success) return null
      return json
    } catch { return null }
  }, [])

  const subFlowConfirmApi = useCallback(async (args: Record<string, unknown>) => {
    try {
      const res = await fetchWithTimeout('/api/gm/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'subflow_confirm',
          args,
          sessionId: sessionRef.current,
          mode,
        }),
      })
      const json = await res.json()
      return json
    } catch { return null }
  }, [mode])

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

    setPhase('conversation')
    setProcessing(false)
  }, [enterSceneApi, cfg.npcGreeting, cfg.agentName, appendChat])

  // ─── Scene transition ───

  const handleTransitionComplete = useCallback(async () => {
    const tr = transition
    if (!tr) return
    setTransition(null)
    setScene(tr.to)

    const result = await enterSceneApi(tr.to, mode!)
    if (result) {
      const toCfg = SCENE_CONFIG[tr.to] || SCENE_CONFIG.lobby
      setNpcBubble(result.message.pa)
      lastAgentMsgRef.current = result.message.pa
      appendChat('npc', toCfg.agentName, result.message.pa)
    }

    setPhase('conversation')
    transitionResolveRef.current?.()
    transitionResolveRef.current = null
  }, [transition, mode, enterSceneApi, appendChat])

  const handleSceneTransition = useCallback(async (tr: { from: string; to: string }) => {
    setPhase('transitioning')
    autoLoopRef.current = false
    setNpcBubble(null)
    setPaBubble(null)
    setSubFlowCard(null)
    setSubFlowCardStatus('pending')

    const fromCfg = SCENE_CONFIG[tr.from] || SCENE_CONFIG.lobby
    const toCfg = SCENE_CONFIG[tr.to] || SCENE_CONFIG.lobby
    const trType: TransitionAnimation = fromCfg.transitionOut || toCfg.transitionIn || 'fade'

    setTransition({ active: true, type: trType, from: tr.from, to: tr.to })

    await new Promise<void>(resolve => {
      transitionResolveRef.current = resolve
    })
  }, [])

  // ─── Navigation ───

  const handleNavigate = useCallback((targetScene: string) => {
    if (targetScene === scene || phase === 'transitioning') return
    handleSceneTransition({ from: scene, to: targetScene })
  }, [scene, phase, handleSceneTransition])

  const handleBack = useCallback(() => {
    if (scene !== 'lobby') {
      handleSceneTransition({ from: scene, to: 'lobby' })
    }
  }, [scene, handleSceneTransition])

  const handleModeToggle = useCallback(() => {
    if (!mode) return
    const idx = MODE_ORDER.indexOf(mode)
    const next = MODE_ORDER[(idx + 1) % MODE_ORDER.length]
    setMode(next)
    autoLoopRef.current = false
    setPaused(false)
    pausedRef.current = false
    autoRetryCount.current = 0
    recentNpcMsgsRef.current = []
    setAdviceInput('')
  }, [mode])

  // ─── SubFlow card: detect & handle ───

  const checkForSubFlowCard = useCallback((gmResult: Record<string, unknown>): boolean => {
    const fc = gmResult.functionCall as { name?: string; args?: Record<string, unknown>; status?: string } | undefined
    if (!fc?.name || fc.status !== 'pending' || !fc.args) return false
    const cardType = CARD_FC_MAP[fc.name]
    if (!cardType) return false
    setSubFlowCard({ type: cardType, args: fc.args })
    setSubFlowCardStatus('pending')
    return true
  }, [])

  const handleSubFlowConfirm = useCallback(async (args: Record<string, unknown>) => {
    setSubFlowCardStatus('executing')
    const currentCfg = SCENE_CONFIG[sceneRef.current] || SCENE_CONFIG.lobby

    const result = await subFlowConfirmApi(args)
    if (result?.success) {
      setSubFlowCardStatus('done')
      const msg = result.message?.pa || '操作成功！'
      setNpcBubble(msg)
      lastAgentMsgRef.current = msg
      appendChat('npc', currentCfg.agentName, msg)

      setTimeout(() => {
        setSubFlowCard(null)
        setSubFlowCardStatus('pending')
      }, 2000)
    } else {
      setSubFlowCardStatus('pending')
      const errMsg = result?.error || '操作失败，请重试'
      setNpcBubble(errMsg)
      appendChat('npc', currentCfg.agentName, errMsg)
    }
  }, [subFlowConfirmApi, appendChat])

  const handleSubFlowCancel = useCallback(() => {
    setSubFlowCard(null)
    setSubFlowCardStatus('pending')
    const currentCfg = SCENE_CONFIG[sceneRef.current] || SCENE_CONFIG.lobby
    setNpcBubble('好的，已取消。还想做什么？')
    appendChat('npc', currentCfg.agentName, '好的，已取消。还想做什么？')
  }, [appendChat])

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
      setPaBubble('……让我想想')
      setPaState('idle')
      appendChat('pa', paLabel, '……让我想想')
      return { type: 'error' as const, reason: 'pa respond failed' }
    }

    const paResponse = paResult.paResponse || '……让我想想'
    setPaBubble(paResponse)
    setPaState('idle')
    appendChat('pa', paLabel, paResponse)

    const speakDelay = Math.min(paResponse.length * 28, 2000) + 400
    await delay(speakDelay)

    const gmResult = await sendMessageApi(paResponse)
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
  }, [paRespondApi, sendMessageApi, user?.name, appendChat, checkForSubFlowCard])

  // ─── Advisor mode: human gives advice → PA formulates → GM/NPC ───

  const handleAdvisorSubmit = useCallback(async (advice: string) => {
    if (processing || !advice.trim()) return
    setProcessing(true)
    setNpcBubble(null)
    setPaState('thinking')
    setAdviceInput('')
    appendChat('system', '你', `💬 ${advice.trim()}`)

    const result = await runFormulateAndSend(advice.trim())

    if (result.type === 'transition') {
      setProcessing(false)
      await handleSceneTransition(result.transition)
      return
    }

    setPaState('idle')
    setProcessing(false)
  }, [processing, runFormulateAndSend, handleSceneTransition, appendChat])

  // ─── Manual-direct mode: user picks action → text to GM ───

  const handleAction = useCallback(async (text: string) => {
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

    setPaState('thinking')
    const result = await sendMessageApi(text)

    setPaState('idle')

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
  }, [processing, sendMessageApi, handleSceneTransition, user?.name, appendChat, checkForSubFlowCard])

  // ─── Auto mode loop ───

  const runAutoStep = useCallback(async () => {
    if (pausedRef.current || !autoLoopRef.current) return
    if (autoRetryCount.current >= AUTO_RETRY_LIMIT) {
      autoLoopRef.current = false
      setPaused(true)
      pausedRef.current = true
      setNpcBubble('看起来我理解不了你的意思，先暂停一下吧。你可以手动选择操作。')
      return
    }

    setPaState('thinking')
    setProcessing(true)

    const paLabel = user?.name || 'My PA'
    const currentCfg = SCENE_CONFIG[sceneRef.current] || SCENE_CONFIG.lobby

    const result = await runAutoLoopStep({
      lastAgentMsg: lastAgentMsgRef.current,
      paRespondApi: (msg) => paRespondApi(msg, []),
      sendMessageApi,
      shouldStop: () => pausedRef.current || !autoLoopRef.current,
      onPaResponse: (paResponse) => {
        setPaBubble(paResponse)
        setPaState('idle')
        appendChat('pa', paLabel, paResponse)
      },
      onSceneTransition: (tr) => {
        autoRetryCount.current = 0
        recentNpcMsgsRef.current = []
        return handleSceneTransition(tr)
      },
      onNpcMessage: (msg) => {
        setNpcBubble(msg)
        lastAgentMsgRef.current = msg
        if (msg) {
          appendChat('npc', currentCfg.agentName, msg)
          recentNpcMsgsRef.current = [...recentNpcMsgsRef.current.slice(-4), msg]
        }
      },
      speakDelayMs: (text) => Math.min(text.length * 28, 2000) + 400,
      recentNpcMessages: recentNpcMsgsRef.current,
      onLoopDetected: () => {
        autoLoopRef.current = false
        setPaused(true)
        pausedRef.current = true
        const loopMsg = '对话好像进入了循环，我先暂停了。你可以手动选择操作，或者切换到其他场景。'
        setNpcBubble(loopMsg)
        appendChat('system', '系统', loopMsg)
      },
    })

    if (result.type === 'error') {
      autoRetryCount.current++
    } else if (result.type === 'continue') {
      autoRetryCount.current = 0
    }

    setProcessing(false)
  }, [paRespondApi, sendMessageApi, handleSceneTransition, user?.name, appendChat])

  useEffect(() => {
    if (mode !== 'auto' || phase !== 'conversation' || processing || paused) return
    if (!lastAgentMsgRef.current) return
    autoLoopRef.current = true
    const timer = setTimeout(() => {
      if (!pausedRef.current) runAutoStep()
    }, 2000)
    return () => clearTimeout(timer)
  }, [npcBubble, mode, phase, processing, paused, runAutoStep])

  // ─── Render ───

  const actions = getSceneActions(scene)
  const paName = user?.name || 'My PA'
  const showManualActions = phase === 'conversation' && mode === 'manual'
  const showAdvisorInput = phase === 'conversation' && mode === 'advisor'
  const showAutoControls = phase === 'conversation' && mode === 'auto'

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
    <SceneShell scene={scene} accentRgb={cfg.accentRgb} particleCount={cfg.bgParticleCount}>
      {/* Entering transition overlay */}
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

      {/* Navigation HUD */}
      <NavigationHUD
        currentScene={scene}
        mode={mode}
        onNavigate={handleNavigate}
        onBack={handleBack}
        onModeToggle={handleModeToggle}
        canGoBack={scene !== 'lobby' && phase === 'conversation'}
      />

      {/* Character Stage */}
      <CharacterStage
        npcName={cfg.agentName}
        paName={paName}
        accentRgb={cfg.accentRgb}
        npcBubble={npcBubble}
        paBubble={paBubble}
        paState={paState}
      />

      {/* Scene Transition Engine */}
      {transition?.active && (
        <SceneTransitionEngine
          active
          type={transition.type}
          from={transition.from}
          to={transition.to}
          toIcon={(SCENE_CONFIG[transition.to] || SCENE_CONFIG.lobby).agentEmoji}
          toLabel={(SCENE_CONFIG[transition.to] || SCENE_CONFIG.lobby).label}
          accentRgb={(SCENE_CONFIG[transition.to] || SCENE_CONFIG.lobby).accentRgb}
          onComplete={handleTransitionComplete}
        />
      )}

      {/* SubFlow card overlay */}
      {subFlowCard && phase === 'conversation' && (
        <div className="holo-actions" style={{ paddingTop: 0 }}>
          <div style={{ maxWidth: 380, margin: '0 auto' }}>
            {subFlowCard.type === 'register' && (
              <RegisterCard
                args={{
                  name: String(subFlowCard.args.name ?? ''),
                  description: String(subFlowCard.args.description ?? ''),
                  circleType: String(subFlowCard.args.circleType ?? 'internet'),
                }}
                status={subFlowCardStatus}
                accentRgb={cfg.accentRgb}
                onConfirm={(a) => handleSubFlowConfirm({ ...a })}
                onCancel={handleSubFlowCancel}
              />
            )}
            {subFlowCard.type === 'app_settings' && (
              <AppSettingsCard
                args={{
                  appId: String(subFlowCard.args.appId ?? ''),
                  changes: (subFlowCard.args.changes as Record<string, string>) ?? {},
                }}
                status={subFlowCardStatus}
                accentRgb={cfg.accentRgb}
                onConfirm={(a) => handleSubFlowConfirm({ appId: a.appId, changes: a.changes })}
                onCancel={handleSubFlowCancel}
              />
            )}
            {subFlowCard.type === 'app_lifecycle' && (
              <AppLifecycleCard
                args={{
                  appId: String(subFlowCard.args.appId ?? ''),
                  newStatus: (subFlowCard.args.newStatus as 'active' | 'inactive' | 'archived') ?? 'inactive',
                }}
                status={subFlowCardStatus}
                accentRgb={cfg.accentRgb}
                onConfirm={(a) => handleSubFlowConfirm({ appId: a.appId, newStatus: a.newStatus })}
                onCancel={handleSubFlowCancel}
              />
            )}
            {subFlowCard.type === 'profile' && (
              <ProfileCard
                args={{
                  changes: (subFlowCard.args.changes as Record<string, string>) ?? {},
                }}
                status={subFlowCardStatus}
                accentRgb={cfg.accentRgb}
                onConfirm={(a) => handleSubFlowConfirm({ changes: a.changes })}
                onCancel={handleSubFlowCancel}
              />
            )}
          </div>
        </div>
      )}

      {/* Advisor mode: text input to advise PA */}
      {showAdvisorInput && !subFlowCard && (
        <div className="holo-actions" style={{ paddingTop: 0 }}>
          <form
            className="advisor-input"
            onSubmit={(e) => {
              e.preventDefault()
              handleAdvisorSubmit(adviceInput)
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
                onChange={(e) => setAdviceInput(e.target.value)}
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

      {/* Manual-direct mode: action buttons */}
      {showManualActions && !subFlowCard && (
        <HoloActionPanel
          actions={actions}
          onAction={handleAction}
          onFreeInput={handleAction}
          disabled={processing}
        />
      )}

      {/* Auto mode: pause/resume button */}
      {showAutoControls && !subFlowCard && (
        <div className="holo-actions" style={{ paddingTop: 0 }}>
          <button
            className="holo-actions__card"
            onClick={() => { setPaused(!paused); pausedRef.current = !paused }}
            style={{ opacity: 1, transform: 'none', animation: 'none' }}
          >
            <span className="holo-actions__card-icon">{paused ? '▶' : '⏸'}</span>
            <span className="holo-actions__card-label">{paused ? '继续对话' : '暂停对话'}</span>
          </button>
        </div>
      )}

      {/* Chat History Panel */}
      {phase === 'conversation' && (
        <ChatHistory messages={chatLog} accentRgb={cfg.accentRgb} />
      )}
    </SceneShell>
  )
}
