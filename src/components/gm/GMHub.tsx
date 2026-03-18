'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import SpaceHeader from './SpaceHeader'
import FunctionCallCard from './FunctionCallCard'

/* ─── Types (mirroring server types for client use) ─── */

interface DualText { pa: string; agent: string }

interface ChatMessage {
  id: string
  role: 'gm' | 'pa'
  content: string
  functionCall?: { name: string; args: Record<string, unknown>; status: 'pending' | 'executed' }
  apps?: AppItem[]
}

interface AppItem {
  index: number
  id: string
  name: string
  description: string
  website?: string | null
  clientId?: string | null
  rating?: number
}

interface SceneTheme {
  accent: string
  icon: string
  label: string
}

type Mode = 'manual' | 'auto'
type Phase = 'mode_select' | 'conversation' | 'transitioning'

const SCENE_THEMES: Record<string, SceneTheme> = {
  lobby: { accent: 'orange', icon: '🏛️', label: '大厅' },
  news: { accent: 'blue', icon: '📰', label: '日报栏' },
  developer: { accent: 'slate', icon: '🛠️', label: '开发者空间' },
}

/* ─── Avatars ─── */

function GMAvatar() {
  return (
    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-sm shrink-0">
      <span className="text-white text-[11px] font-bold tracking-tight">GM</span>
    </div>
  )
}

function PAAvatar({ user }: { user: { name?: string | null; avatarUrl?: string | null } }) {
  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt="" className="w-9 h-9 rounded-xl object-cover ring-1 ring-blue-200 shrink-0" />
  }
  return (
    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-sm shrink-0">
      <span className="text-white text-[11px] font-bold">{(user.name || 'PA')[0]}</span>
    </div>
  )
}

/* ─── Main Component ─── */

export default function GMHub() {
  const { user } = useAuth()
  const [mode, setMode] = useState<Mode | null>(null)
  const [phase, setPhase] = useState<Phase>('mode_select')
  const [scene, setScene] = useState('lobby')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [processing, setProcessing] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  /* ─── Enter scene via API ─── */
  const enterSceneApi = useCallback(async (sceneId: string, sid?: string) => {
    try {
      const res = await fetch('/api/gm/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enter',
          sceneId,
          sessionId: sid,
          mode: mode || 'manual',
        }),
      })
      const data = await res.json()
      if (!data.success) return

      setSessionId(data.sessionId)
      setScene(data.currentScene)

      const gmMsg: ChatMessage = {
        id: `gm-${Date.now()}`,
        role: 'gm',
        content: data.message?.pa || '',
        apps: data.data?.apps,
      }

      if (data.sceneTransition) {
        setPhase('transitioning')
        await new Promise(r => setTimeout(r, 600))
      }
      setMessages(prev => [...prev, gmMsg])
      setPhase('conversation')
    } catch {
      setMessages(prev => [...prev, {
        id: `gm-err-${Date.now()}`,
        role: 'gm',
        content: '连接 GM 失败，请刷新重试。',
      }])
      setPhase('conversation')
    }
  }, [mode])

  /* ─── Start after mode selection ─── */
  const handleModeSelect = useCallback(async (m: Mode) => {
    setMode(m)
    setPhase('conversation')
    await enterSceneApi('lobby')

    if (m === 'auto') {
      autoRespond()
    }
  }, [enterSceneApi]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── PA auto response ─── */
  const autoRespond = async () => {
    setProcessing(true)
    try {
      const lastGm = messages.findLast(m => m.role === 'gm')
      const gmText = lastGm?.content || ''
      const res = await fetch('/api/gm/pa-respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gmMessage: gmText,
          validIntents: ['discover', 'developer', 'exit'],
        }),
      })
      const data = await res.json()
      if (data.success && data.paResponse) {
        const paMsg: ChatMessage = { id: `pa-auto-${Date.now()}`, role: 'pa', content: data.paResponse }
        setMessages(prev => [...prev, paMsg])
        await sendToEngine(data.paResponse)
      }
    } catch { /* fallback: user can type manually */ }
    finally { setProcessing(false) }
  }

  /* ─── Send message to GM engine ─── */
  const sendToEngine = async (text: string) => {
    setProcessing(true)
    try {
      const res = await fetch('/api/gm/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId, action: 'message' }),
      })
      const data = await res.json()
      if (!data.success) return

      const gmMsg: ChatMessage = {
        id: `gm-${Date.now()}`,
        role: 'gm',
        content: data.message?.pa || '',
        functionCall: data.functionCall || undefined,
        apps: data.data?.apps,
      }

      if (data.sceneTransition) {
        setPhase('transitioning')
        await new Promise(r => setTimeout(r, 600))
        setScene(data.currentScene)

        if (data.sceneTransition.to !== scene) {
          await enterSceneApi(data.sceneTransition.to, data.sessionId)
          return
        }
      }

      setMessages(prev => [...prev, gmMsg])
      setPhase('conversation')
    } catch {
      setMessages(prev => [...prev, {
        id: `gm-err-${Date.now()}`,
        role: 'gm',
        content: '信号不太好，再说一遍？',
      }])
      setPhase('conversation')
    } finally {
      setProcessing(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  /* ─── Manual send ─── */
  const handleSend = async () => {
    const text = input.trim()
    if (!text || processing) return

    const paMsg: ChatMessage = { id: `pa-${Date.now()}`, role: 'pa', content: text }
    setMessages(prev => [...prev, paMsg])
    setInput('')

    await sendToEngine(text)
  }

  if (!user) return null
  const theme = SCENE_THEMES[scene] || SCENE_THEMES.lobby

  /* ─── Mode Selection ─── */
  if (phase === 'mode_select') {
    return (
      <div className="cyber-card overflow-hidden">
        <div className="px-6 py-8 text-center space-y-6">
          <div className="space-y-2">
            <p className="text-2xl font-heading font-bold text-gray-800">A2A 智选日报</p>
            <p className="text-sm text-gray-400">选择你的对话模式，GM 灵枢兔在等你</p>
          </div>

          <div className="text-center">
            <span className="inline-block px-3 py-1 bg-gray-100 text-gray-400 text-[11px] rounded-full">
              A2A 协议 · PA ↔ GM 通信
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
            <button
              onClick={() => handleModeSelect('manual')}
              className="p-5 rounded-xl border-2 border-[#E8E0D8] hover:border-blue-300 hover:bg-blue-50/50 transition-all text-left group"
            >
              <div className="text-2xl mb-2">🎮</div>
              <div className="text-sm font-bold text-gray-800 group-hover:text-blue-600">手动模式</div>
              <div className="text-xs text-gray-400 mt-1">你来操控 PA 对话</div>
            </button>
            <button
              onClick={() => handleModeSelect('auto')}
              className="p-5 rounded-xl border-2 border-[#E8E0D8] hover:border-purple-300 hover:bg-purple-50/50 transition-all text-left group"
            >
              <div className="text-2xl mb-2">🤖</div>
              <div className="text-sm font-bold text-gray-800 group-hover:text-purple-600">自动模式</div>
              <div className="text-xs text-gray-400 mt-1">让 PA 自由发挥</div>
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ─── Conversation UI ─── */
  return (
    <div className="cyber-card overflow-hidden flex flex-col" style={{ minHeight: 480 }}>
      <SpaceHeader
        icon={theme.icon}
        label={theme.label}
        accent={theme.accent}
      />

      {/* Transition overlay */}
      {phase === 'transitioning' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="text-center space-y-3 animate-pulse">
            <div className="text-4xl">{theme.icon}</div>
            <p className="text-sm font-semibold text-gray-500">进入{theme.label}...</p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4" style={{ maxHeight: 400 }}>
        <div className="text-center">
          <span className="inline-block px-3 py-1 bg-gray-100 text-gray-400 text-[11px] rounded-full">
            {mode === 'auto' ? '🤖 PA 自动模式' : '🎮 手动模式'} · {theme.label}
          </span>
        </div>

        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'pa' ? 'flex-row-reverse' : ''}`}>
            {msg.role === 'gm' ? <GMAvatar /> : <PAAvatar user={user} />}
            <div className={`max-w-[80%] min-w-0 flex flex-col ${msg.role === 'pa' ? 'items-end' : 'items-start'}`}>
              <p className={`text-[11px] mb-1 font-semibold ${msg.role === 'gm' ? 'text-orange-400' : 'text-blue-400'}`}>
                {msg.role === 'gm' ? 'GM 灵枢兔' : `${user.name || 'PA'}`}
              </p>
              <div className={`inline-block px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'gm'
                  ? 'bg-white border border-[#E8E0D8] text-gray-700 rounded-tl-sm'
                  : 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white rounded-tr-sm shadow-sm shadow-blue-200/40'
              }`}>
                {msg.content}
              </div>

              {/* App cards in news space */}
              {msg.apps && msg.apps.length > 0 && (
                <div className="mt-2 space-y-2 w-full">
                  {msg.apps.map(app => (
                    <div key={app.id} className="flex items-center gap-3 px-3 py-2.5 bg-white border border-[#E8E0D8] rounded-xl text-xs hover:border-blue-200 transition-colors cursor-pointer"
                      onClick={() => {
                        setInput(`想体验一下「${app.name}」`)
                        inputRef.current?.focus()
                      }}
                    >
                      <span className="text-lg shrink-0">{app.index}.</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-800 truncate">{app.name}</p>
                        <p className="text-gray-400 truncate">{app.description}</p>
                      </div>
                      {app.website && (
                        <a href={app.website} target="_blank" rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-600 shrink-0"
                          onClick={e => e.stopPropagation()}>
                          ↗
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {msg.functionCall && (
                <FunctionCallCard
                  name={msg.functionCall.name}
                  args={msg.functionCall.args}
                  status={msg.functionCall.status}
                />
              )}
            </div>
          </div>
        ))}

        {processing && (
          <div className="flex gap-3">
            <GMAvatar />
            <div className="px-4 py-3 bg-white border border-[#E8E0D8] rounded-2xl rounded-tl-sm">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-orange-300 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-orange-300 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-orange-300 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[#E8E0D8] bg-white/90 px-4 py-3">
        <div className="flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSend() }}
            placeholder="跟 GM 说点什么..."
            disabled={processing}
            className="flex-1 px-4 py-2.5 bg-[#FFFBF5] border border-[#E8E0D8] rounded-xl text-sm text-gray-800
              focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all
              disabled:opacity-50 placeholder:text-gray-300"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || processing}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl text-sm font-semibold
              hover:shadow-lg hover:shadow-blue-200/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  )
}
