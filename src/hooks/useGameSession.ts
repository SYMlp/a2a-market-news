import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { SCENE_CONFIG } from '@/lib/scene-visuals'
import type { TransitionAnimation } from '@/lib/scene-visuals/types'
import { fetchWithTimeout } from '@/lib/fetch-timeout'
import type { ChatMessage } from '@/components/scene/ChatHistory'
import type { GameMode } from '@/components/scene/TownApproach'
import type { SessionSummary } from '@/components/scene/TownFarewell'
import type { ComponentSpec } from '@/lib/component-runtime/types'

export type Phase = 'approach' | 'entering' | 'conversation' | 'transitioning' | 'farewell'

export function useGameSession() {
  const { user, loading: authLoading } = useAuth()

  const [phase, setPhase] = useState<Phase>('approach')
  const [mode, setMode] = useState<GameMode | null>(null)
  const [scene, setScene] = useState('lobby')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  const [npcBubble, setNpcBubble] = useState<string | null>(null)
  const [paBubble, setPaBubble] = useState<string | null>(null)
  const [paState, setPaState] = useState<'idle' | 'walking' | 'thinking'>('idle')
  const [npcState, setNpcState] = useState<'idle' | 'thinking'>('idle')

  const [chatLog, setChatLog] = useState<ChatMessage[]>([])
  const [paused, setPaused] = useState(false)
  const [adviceInput, setAdviceInput] = useState('')
  const [specsCache, setSpecsCache] = useState<Record<string, ComponentSpec> | null>(null)
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null)
  const [sceneData, setSceneData] = useState<Record<string, unknown> | null>(null)
  const [preconditions, setPreconditions] = useState<Record<string, boolean>>({})
  const [feedbackPanelOpen, setFeedbackPanelOpen] = useState(false)
  const [behaviorPresentation, setBehaviorPresentation] = useState<{
    style: string
    data: unknown[]
    card?: unknown
    animation?: unknown
  } | null>(null)
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
  const lastAgentMsgRef = useRef('')
  const sceneRef = useRef(scene)
  sceneRef.current = scene
  const transitionResolveRef = useRef<(() => void) | null>(null)
  const adviceInputRef = useRef<HTMLInputElement>(null)

  // Cleanup callback for refs owned by other hooks (e.g. useAutoLoop).
  // The page registers a function here after calling those hooks.
  const sessionCleanupRef = useRef<(() => void) | undefined>(undefined)

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

  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = '/api/auth/login'
    }
  }, [authLoading, user])

  useEffect(() => {
    const types = ['app_settings', 'profile', 'app_lifecycle', 'register'] as const
    Promise.all(
      types.map(async (t) => {
        const res = await fetch(`/api/specs/${t}`)
        if (!res.ok) throw new Error(`Failed to load spec: ${t}`)
        return [t, (await res.json())] as const
      })
    )
      .then((pairs) => setSpecsCache(Object.fromEntries(pairs)))
      .catch(() => {
        /* non-fatal: spec preload failed */
      })
  }, [])

  const handleSessionEnd = useCallback((farewellMsg?: string, apiSummary?: {
    scenesVisited?: string[]
    achievements?: Array<{ sceneId: string; actionId: string; label: string; timestamp: number }>
    totalTurns?: number
  }) => {
    sessionCleanupRef.current?.()
    setNpcState('idle')
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
    sessionCleanupRef.current?.()
    setPhase('approach')
    setMode(null)
    setScene('lobby')
    setSessionId(null)
    sessionRef.current = null
    setChatLog([])
    setNpcBubble(null)
    setPaBubble(null)
    setPaState('idle')
    setNpcState('idle')
    setPaused(false)
    pausedRef.current = false
    lastAgentMsgRef.current = ''
    setSessionSummary(null)
    setSceneData(null)
    setPreconditions({})
    setFeedbackPanelOpen(false)
    setBehaviorPresentation(null)
  }, [])

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
      setBehaviorPresentation(json.behaviorPresentation ?? null)
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
      setBehaviorPresentation(json.behaviorPresentation ?? null)
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

  return {
    user,
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
    cfg,
    appendChat,
    handleFarewellComplete,
    enterSceneApi,
    sendMessageApi,
    paRespondApi,
    subFlowConfirmApi,
  }
}
