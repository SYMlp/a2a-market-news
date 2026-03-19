import { useCallback, useEffect, useRef } from 'react'
import { SCENE_CONFIG } from '@/lib/scene-visuals'
import { runAutoLoopStep } from '@/lib/pa'
import type { ChatMessage } from '@/components/scene/ChatHistory'
import type { GameMode } from '@/components/scene/TownApproach'

type Phase = 'approach' | 'entering' | 'conversation' | 'transitioning' | 'farewell'

const AUTO_RETRY_LIMIT = 3

interface UseAutoLoopParams {
  mode: GameMode | null
  phase: Phase
  processing: boolean
  setProcessing: (v: boolean) => void
  paused: boolean
  setPaused: (v: boolean) => void
  pausedRef: React.MutableRefObject<boolean>
  npcBubble: string | null
  lastAgentMsgRef: React.MutableRefObject<string>
  sceneRef: React.MutableRefObject<string>
  userName: string
  appendChat: (role: ChatMessage['role'], name: string, text: string) => void
  paRespondApi: (gmMessage: string, validIntents: string[]) => Promise<{
    success: boolean
    paResponse: string
  } | null>
  sendMessageApi: (text: string, originalMessage?: string) => Promise<{
    success: boolean
    message?: { pa: string }
    sceneTransition?: { from: string; to: string }
  } | null>
  handleSceneTransition: (tr: { from: string; to: string }) => Promise<void>
  setPaState: (state: 'idle' | 'walking' | 'thinking') => void
  setNpcState: (state: 'idle' | 'thinking') => void
  setNpcBubble: (text: string | null) => void
  setPaBubble: (text: string | null) => void
}

export function useAutoLoop(params: UseAutoLoopParams) {
  const {
    mode, phase, processing, setProcessing,
    paused, setPaused, pausedRef,
    npcBubble,
    lastAgentMsgRef, sceneRef, userName,
    appendChat,
    paRespondApi, sendMessageApi, handleSceneTransition,
    setPaState, setNpcState, setNpcBubble, setPaBubble,
  } = params

  const autoLoopRef = useRef(false)
  const autoRetryCount = useRef(0)
  const recentNpcMsgsRef = useRef<string[]>([])

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

    const paLabel = userName
    const currentCfg = SCENE_CONFIG[sceneRef.current] || SCENE_CONFIG.lobby

    const result = await runAutoLoopStep({
      lastAgentMsg: lastAgentMsgRef.current,
      paRespondApi: (msg) => paRespondApi(msg, []),
      sendMessageApi,
      shouldStop: () => pausedRef.current || !autoLoopRef.current,
      onPaResponse: (paResponse) => {
        setPaBubble(paResponse)
        setPaState('idle')
        setNpcState('thinking')
        appendChat('pa', paLabel, paResponse)
      },
      onSceneTransition: (tr) => {
        autoRetryCount.current = 0
        recentNpcMsgsRef.current = []
        return handleSceneTransition(tr)
      },
      onNpcMessage: (msg) => {
        setNpcState('idle')
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
        setNpcState('idle')
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

    setNpcState('idle')
    setProcessing(false)
  }, [paRespondApi, sendMessageApi, handleSceneTransition, userName, appendChat,
      setPaused, pausedRef, setProcessing, setPaState, setNpcState, setNpcBubble,
      setPaBubble, lastAgentMsgRef, sceneRef])

  useEffect(() => {
    if (mode !== 'auto' || phase !== 'conversation' || processing || paused) return
    if (!lastAgentMsgRef.current) return
    autoLoopRef.current = true
    const timer = setTimeout(() => {
      if (!pausedRef.current) runAutoStep()
    }, 2000)
    return () => clearTimeout(timer)
  }, [npcBubble, mode, phase, processing, paused, runAutoStep, lastAgentMsgRef, pausedRef])

  return { autoLoopRef, autoRetryCount, recentNpcMsgsRef }
}
