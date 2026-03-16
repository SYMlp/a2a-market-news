'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { SCENE_CONFIG } from '@/lib/gm/scene-config'
import { SCENES } from '@/lib/gm/scenes'
import SceneShell from '@/components/scene/SceneShell'
import NavigationHUD from '@/components/scene/NavigationHUD'
import CharacterStage from '@/components/scene/CharacterStage'
import HoloActionPanel from '@/components/scene/HoloActionPanel'
import MistOverlay from '@/components/scene/MistOverlay'

type Phase = 'entering' | 'walking' | 'mode_select' | 'conversation' | 'transitioning'

interface ActionOption {
  id: string
  label: string
  icon?: string
  outcome?: 'stay' | 'move'
}

const ACTION_ICONS: Record<string, string> = {
  go_news: '📰', go_developer: '🛠️',
  experience: '🎮', report: '📝',
  view_feedback: '💬', register_app: '➕',
  back_lobby: '🏛️',
}

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

  const [phase, setPhase] = useState<Phase>('entering')
  const [mode, setMode] = useState<'manual' | 'auto' | null>(null)
  const [scene, setScene] = useState('lobby')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  const [npcBubble, setNpcBubble] = useState<string | null>(null)
  const [paBubble, setPaBubble] = useState<string | null>(null)
  const [paState, setPaState] = useState<'idle' | 'walking' | 'thinking'>('idle')

  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(false)
  pausedRef.current = paused
  const sessionRef = useRef(sessionId)
  sessionRef.current = sessionId
  const autoLoopRef = useRef(false)
  const lastAgentMsgRef = useRef('')
  const sceneRef = useRef(scene)
  sceneRef.current = scene

  const cfg = SCENE_CONFIG[scene] || SCENE_CONFIG.lobby

  // ─── Entrance sequence ───

  useEffect(() => {
    const timers = [
      setTimeout(() => {
        setPaState('walking')
        setPhase('walking')
      }, 600),
      setTimeout(() => {
        setPaState('idle')
        setNpcBubble(cfg.npcGreeting)
        setPhase('mode_select')
      }, 2200),
    ]
    return () => timers.forEach(clearTimeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── API helpers (unchanged logic) ───

  const enterSceneApi = useCallback(async (sceneId: string, m: 'manual' | 'auto') => {
    try {
      const res = await fetch('/api/gm/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enter', sceneId, mode: m, sessionId: sessionRef.current }),
      })
      const json = await res.json()
      if (!json.success) return null
      setSessionId(json.sessionId)
      sessionRef.current = json.sessionId
      return json
    } catch { return null }
  }, [])

  const sendMessageApi = useCallback(async (text: string) => {
    try {
      const res = await fetch('/api/gm/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'message', message: text, sessionId: sessionRef.current, mode }),
      })
      const json = await res.json()
      if (!json.success) return null
      return json
    } catch { return null }
  }, [mode])

  const paRespondApi = useCallback(async (gmMessage: string) => {
    try {
      const res = await fetch('/api/gm/pa-respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gmMessage }),
      })
      const json = await res.json()
      if (!json.success) return null
      return json
    } catch { return null }
  }, [])

  // ─── Mode selection ───

  const handleModeSelect = useCallback(async (m: 'manual' | 'auto') => {
    setMode(m)
    setProcessing(true)
    setNpcBubble(null)

    const result = await enterSceneApi('lobby', m)
    if (result) {
      setNpcBubble(result.message.pa)
      lastAgentMsgRef.current = result.message.pa
    }
    setPhase('conversation')
    setProcessing(false)
  }, [enterSceneApi])

  // ─── Scene transition ───

  const handleSceneTransition = useCallback(async (tr: { from: string; to: string }) => {
    setPhase('transitioning')
    autoLoopRef.current = false
    setNpcBubble(null)
    setPaBubble(null)

    await delay(1500)

    setScene(tr.to)
    setPaState('walking')

    await delay(1400)
    setPaState('idle')

    const result = await enterSceneApi(tr.to, mode!)
    if (result) {
      setNpcBubble(result.message.pa)
      lastAgentMsgRef.current = result.message.pa
    }

    setPhase('conversation')
  }, [mode, enterSceneApi])

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
    const next = mode === 'auto' ? 'manual' : 'auto'
    setMode(next)
    autoLoopRef.current = false
    setPaused(false)
    pausedRef.current = false
  }, [mode])

  // ─── Manual action / free input ───

  const handleAction = useCallback(async (text: string) => {
    if (processing) return
    setProcessing(true)
    setPaBubble(text)
    setPaState('idle')

    await delay(300)

    const result = await sendMessageApi(text)
    if (result) {
      setPaBubble(null)
      setNpcBubble(result.message.pa)
      lastAgentMsgRef.current = result.message.pa

      if (result.sceneTransition) {
        setProcessing(false)
        await handleSceneTransition(result.sceneTransition)
        return
      }
    }
    setProcessing(false)
  }, [processing, sendMessageApi, handleSceneTransition])

  // ─── Auto mode loop ───

  const runAutoStep = useCallback(async () => {
    if (pausedRef.current || !autoLoopRef.current) return

    setPaState('thinking')
    setProcessing(true)

    const gmMsg = lastAgentMsgRef.current
    if (!gmMsg) { setProcessing(false); setPaState('idle'); return }

    const paResult = await paRespondApi(gmMsg)
    if (!paResult || !autoLoopRef.current) { setProcessing(false); setPaState('idle'); return }

    setPaBubble(paResult.paResponse)
    setPaState('idle')

    await delay(Math.min(paResult.paResponse.length * 28, 2000) + 400)

    if (pausedRef.current || !autoLoopRef.current) { setProcessing(false); return }

    const gmResult = await sendMessageApi(paResult.paResponse)
    if (!gmResult || !autoLoopRef.current) { setProcessing(false); return }

    if (gmResult.sceneTransition) {
      setProcessing(false)
      await handleSceneTransition(gmResult.sceneTransition)
      return
    }

    setPaBubble(null)
    setNpcBubble(gmResult.message.pa)
    lastAgentMsgRef.current = gmResult.message.pa
    setProcessing(false)
  }, [paRespondApi, sendMessageApi, handleSceneTransition])

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
  const showActions = phase === 'conversation' && mode === 'manual'

  return (
    <SceneShell scene={scene} accentRgb={cfg.accentRgb} particleCount={cfg.bgParticleCount}>
      {/* Auth gate */}
      {!authLoading && !user && phase !== 'entering' && (
        <div className="lobby-enter" style={{ flexDirection: 'column', gap: '1.5rem', position: 'absolute', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '3rem' }}>🔐</div>
          <div style={{ color: 'rgba(200,220,240,0.6)', fontSize: '0.9rem' }}>需要登录才能进入报社</div>
          <a
            href="/api/auth/login"
            className="landing-cta landing-cta--on"
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.8rem 2rem', background: 'transparent', border: 'none', textDecoration: 'none', opacity: 1 }}
          >
            <span className="landing-cta__ring" />
            <span className="landing-cta__label" style={{ color: '#00d2ff' }}>登录 SecondMe</span>
          </a>
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

      {/* Mode Selection Mist */}
      {phase === 'mode_select' && (user || authLoading) && (
        <MistOverlay onSelect={handleModeSelect} />
      )}

      {/* Scene Transition */}
      {phase === 'transitioning' && (
        <div className="scene-tr-v2">
          <div className="scene-tr-v2__content">
            <div className="scene-tr-v2__icon">{cfg.agentEmoji}</div>
            <div className="scene-tr-v2__label">前往 {cfg.label}</div>
            <div className="scene-tr-v2__sub">LOADING SPACE</div>
            <div className="scene-tr-v2__bar">
              <div className="scene-tr-v2__bar-fill" />
            </div>
          </div>
        </div>
      )}

      {/* Action Panel */}
      {showActions && (
        <HoloActionPanel
          actions={actions}
          onAction={handleAction}
          onFreeInput={handleAction}
          disabled={processing}
        />
      )}

      {/* Auto mode: pause indicator */}
      {phase === 'conversation' && mode === 'auto' && (
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
    </SceneShell>
  )
}
