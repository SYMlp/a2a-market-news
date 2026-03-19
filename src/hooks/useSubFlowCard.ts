import { useState, useCallback } from 'react'
import type { SpecFormCardStatus } from '@/components/scene/SpecFormCard'
import type { ChatMessage } from '@/components/scene/ChatHistory'
import { SCENE_CONFIG } from '@/lib/scene-visuals'
import { fetchWithTimeout } from '@/lib/fetch-timeout'

const CARD_FC_MAP: Record<string, string> = {
  'GM.registerApp': 'register',
  'GM.updateAppSettings': 'app_settings',
  'GM.updateProfile': 'profile',
  'GM.changeAppStatus': 'app_lifecycle',
}

interface UseSubFlowCardParams {
  subFlowConfirmApi: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>
  appendChat: (role: ChatMessage['role'], name: string, text: string) => void
  mode: string | null
  sessionRef: React.MutableRefObject<string | null>
  sceneRef: React.MutableRefObject<string>
  setNpcBubble: (msg: string | null) => void
  lastAgentMsgRef: React.MutableRefObject<string>
}

export function useSubFlowCard(params: UseSubFlowCardParams) {
  const {
    subFlowConfirmApi, appendChat, mode,
    sessionRef, sceneRef, setNpcBubble, lastAgentMsgRef,
  } = params

  const [subFlowCard, setSubFlowCard] = useState<{ type: string; args: Record<string, unknown> } | null>(null)
  const [subFlowCardStatus, setSubFlowCardStatus] = useState<SpecFormCardStatus>('pending')

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
      const msg = (result.message as { pa?: string })?.pa || '操作成功！'
      setNpcBubble(msg)
      lastAgentMsgRef.current = msg
      appendChat('npc', currentCfg.agentName, msg)

      setTimeout(() => {
        setSubFlowCard(null)
        setSubFlowCardStatus('pending')
      }, 2000)
    } else {
      setSubFlowCardStatus('pending')
      const errMsg = (result?.error as string) || '操作失败，请重试'
      setNpcBubble(errMsg)
      appendChat('npc', currentCfg.agentName, errMsg)
    }
  }, [subFlowConfirmApi, appendChat, sceneRef, setNpcBubble, lastAgentMsgRef])

  const handleSubFlowCancel = useCallback(async () => {
    try {
      await fetchWithTimeout('/api/gm/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'subflow_cancel',
          sessionId: sessionRef.current,
          mode,
        }),
      })
    } catch { /* server cancel is best-effort */ }
    setSubFlowCard(null)
    setSubFlowCardStatus('pending')
    const currentCfg = SCENE_CONFIG[sceneRef.current] || SCENE_CONFIG.lobby
    setNpcBubble('好的，已取消。还想做什么？')
    appendChat('npc', currentCfg.agentName, '好的，已取消。还想做什么？')
  }, [appendChat, mode, sessionRef, sceneRef, setNpcBubble])

  const resetSubFlowCard = useCallback(() => {
    setSubFlowCard(null)
    setSubFlowCardStatus('pending')
  }, [])

  return {
    subFlowCard,
    subFlowCardStatus,
    checkForSubFlowCard,
    handleSubFlowConfirm,
    handleSubFlowCancel,
    resetSubFlowCard,
  }
}
