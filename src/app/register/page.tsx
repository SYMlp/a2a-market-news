'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/Header'
import { useAuth } from '@/contexts/AuthContext'

/* ─── Types ──────────────────────────────────────────── */

interface FunctionCallArgs {
  name: string
  description: string
  circleType: string
}

type FCStatus = 'pending' | 'executing' | 'done'

interface ChatMessage {
  id: string
  role: 'gm' | 'pa'
  content: string
  functionCall?: { args: FunctionCallArgs; status: FCStatus }
  resultId?: string
}

type Phase = 'chatting' | 'reviewing' | 'done'

const CIRCLES = [
  { value: 'internet', emoji: '🌐', label: '互联网圈', desc: '实用型' },
  { value: 'game', emoji: '🎮', label: '游戏圈', desc: '娱乐型' },
  { value: 'wilderness', emoji: '🚀', label: '无人区圈', desc: '实验型' },
] as const

/* ─── Avatars ────────────────────────────────────────── */

function GMAvatar() {
  return (
    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-sm shrink-0">
      <span className="text-white text-[11px] font-bold tracking-tight">GM</span>
    </div>
  )
}

function PAAvatar({ user }: { user: { name?: string | null; avatarUrl?: string | null } }) {
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        className="w-9 h-9 rounded-xl object-cover ring-1 ring-blue-200 shrink-0"
      />
    )
  }
  return (
    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-sm shrink-0">
      <span className="text-white text-[11px] font-bold">{(user.name || 'PA')[0]}</span>
    </div>
  )
}

/* ─── Function Call Card ─────────────────────────────── */

function FunctionCallCard({
  args,
  status,
  onEdit,
  onConfirm,
  confirming,
}: {
  args: FunctionCallArgs
  status: FCStatus
  onEdit: (a: FunctionCallArgs) => void
  onConfirm: () => void
  confirming: boolean
}) {
  const editable = status === 'pending'
  const circle = CIRCLES.find(c => c.value === args.circleType) || CIRCLES[0]

  const borderColor =
    status === 'done' ? 'border-green-300' :
    status === 'executing' ? 'border-orange-300' :
    'border-[#D4C8BC]'

  const headerBg =
    status === 'done' ? 'bg-green-50 border-green-200' :
    status === 'executing' ? 'bg-orange-50 border-orange-200' :
    'bg-[#F5F0EA] border-[#E8E0D8]'

  const dotColor =
    status === 'done' ? 'bg-green-500' :
    status === 'executing' ? 'bg-orange-400 animate-pulse' :
    'bg-amber-400'

  return (
    <div className={`mt-3 rounded-xl border overflow-hidden text-xs ${borderColor}`}>
      {/* header */}
      <div className={`px-4 py-2.5 flex items-center gap-2 border-b ${headerBg}`}>
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <code className="text-gray-500 font-mono">
          GM.registerApp()
          {status === 'done' && <span className="text-green-600 ml-2 font-sans">✓ 已执行</span>}
          {status === 'executing' && <span className="text-orange-500 ml-2 font-sans">执行中...</span>}
        </code>
      </div>

      {/* fields */}
      <div className="px-4 py-3.5 space-y-3 bg-white/50">
        <FieldRow label="name" editable={editable}>
          {editable ? (
            <input
              value={args.name}
              onChange={e => onEdit({ ...args, name: e.target.value })}
              className="flex-1 px-2.5 py-1.5 bg-white border border-[#E8E0D8] rounded-lg text-gray-800 text-sm
                focus:border-orange-400 focus:ring-1 focus:ring-orange-100 focus:outline-none transition-all"
            />
          ) : (
            <span className="text-gray-800 text-sm">{args.name}</span>
          )}
        </FieldRow>

        <FieldRow label="description" editable={editable}>
          {editable ? (
            <input
              value={args.description}
              onChange={e => onEdit({ ...args, description: e.target.value })}
              className="flex-1 px-2.5 py-1.5 bg-white border border-[#E8E0D8] rounded-lg text-gray-800 text-sm
                focus:border-orange-400 focus:ring-1 focus:ring-orange-100 focus:outline-none transition-all"
            />
          ) : (
            <span className="text-gray-800 text-sm">{args.description}</span>
          )}
        </FieldRow>

        <FieldRow label="circleType" editable={editable}>
          {editable ? (
            <div className="flex gap-2 flex-wrap">
              {CIRCLES.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => onEdit({ ...args, circleType: c.value })}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    args.circleType === c.value
                      ? 'bg-orange-100 border-orange-300 text-orange-700 border shadow-sm'
                      : 'bg-white border border-[#E8E0D8] text-gray-500 hover:border-orange-200'
                  }`}
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-gray-800 text-sm">{circle.emoji} {circle.label}</span>
          )}
        </FieldRow>
      </div>

      {/* confirm button */}
      {status === 'pending' && (
        <div className="px-4 py-3 border-t border-[#E8E0D8] bg-[#F8F5F0]">
          <button
            onClick={onConfirm}
            disabled={confirming || !args.name.trim() || !args.description.trim()}
            className="w-full py-2.5 bg-gradient-to-r from-orange-400 to-amber-500 text-white rounded-lg text-sm font-semibold
              hover:shadow-md hover:shadow-orange-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {confirming ? '执行中...' : '确认执行'}
          </button>
          <p className="text-center text-[10px] text-gray-400 mt-2">
            可直接修改上方字段 · 确认后 GM 将录入系统
          </p>
        </div>
      )}
    </div>
  )
}

function FieldRow({
  label,
  editable,
  children,
}: {
  label: string
  editable: boolean
  children: React.ReactNode
}) {
  return (
    <div className={`flex ${editable ? 'items-start' : 'items-center'} gap-3`}>
      <code className="text-gray-400 font-mono w-24 shrink-0 pt-1.5">{label}</code>
      {children}
    </div>
  )
}

/* ─── Main Page ──────────────────────────────────────── */

export default function RegisterPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [phase, setPhase] = useState<Phase>('chatting')
  const [editArgs, setEditArgs] = useState<FunctionCallArgs | null>(null)
  const [processing, setProcessing] = useState(false)
  const [registering, setRegistering] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // GM welcome
  useEffect(() => {
    if (user && messages.length === 0) {
      const t = setTimeout(() => {
        setMessages([{
          id: 'welcome',
          role: 'gm',
          content: `你好，${user.name || '开发者'}！我是 A2A 智选日报的 GM。\n\n你的 PA 想注册一个新应用？跟我聊聊——叫什么名字，是做什么的？`,
        }])
      }, 400)
      return () => clearTimeout(t)
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── send message ─── */
  const send = async () => {
    const text = input.trim()
    if (!text || processing || phase === 'done') return

    const paMsg: ChatMessage = { id: `pa-${Date.now()}`, role: 'pa', content: text }
    setMessages(prev => [...prev, paMsg])
    setInput('')

    if (phase === 'reviewing') {
      setMessages(prev => [...prev, {
        id: `gm-ack-${Date.now()}`,
        role: 'gm',
        content: '收到补充信息！你可以直接在上方卡片修改字段，然后点确认。',
      }])
      inputRef.current?.focus()
      return
    }

    setProcessing(true)
    try {
      const allPaTexts = [...messages, paMsg]
        .filter(m => m.role === 'pa')
        .map(m => m.content)

      const res = await fetch('/api/register/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allPaTexts }),
      })
      const data = await res.json()

      if (data.complete) {
        const args = data.extracted as FunctionCallArgs
        setEditArgs(args)
        setPhase('reviewing')
        setMessages(prev => [...prev, {
          id: `gm-fc-${Date.now()}`,
          role: 'gm',
          content: '收到！让我整理一下你的应用信息——',
          functionCall: { args, status: 'pending' },
        }])
      } else {
        setMessages(prev => [...prev, {
          id: `gm-follow-${Date.now()}`,
          role: 'gm',
          content: data.followUp || '能告诉我你的应用叫什么名字吗？',
        }])
      }
    } catch {
      setMessages(prev => [...prev, {
        id: `gm-err-${Date.now()}`,
        role: 'gm',
        content: '信号不太好，再说一遍？',
      }])
    } finally {
      setProcessing(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  /* ─── confirm registration ─── */
  const confirm = async () => {
    if (!editArgs || registering) return
    setRegistering(true)

    setMessages(prev => prev.map(m =>
      m.functionCall
        ? { ...m, functionCall: { args: editArgs, status: 'executing' as const } }
        : m
    ))

    try {
      const res = await fetch('/api/app-pa/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editArgs),
      })
      const data = await res.json()

      if (data.success) {
        setMessages(prev => [
          ...prev.map(m =>
            m.functionCall
              ? { ...m, functionCall: { args: editArgs, status: 'done' as const } }
              : m
          ),
          {
            id: `gm-ok-${Date.now()}`,
            role: 'gm',
            content: `注册成功！「${editArgs.name}」已正式录入 A2A 智选日报系统。\n\n欢迎来到 Agent Network！`,
            resultId: data.data.id,
          },
        ])
        setPhase('done')
      } else {
        setMessages(prev => [
          ...prev.map(m =>
            m.functionCall
              ? { ...m, functionCall: { args: editArgs, status: 'pending' as const } }
              : m
          ),
          {
            id: `gm-fail-${Date.now()}`,
            role: 'gm',
            content: `出了点问题：${data.error}\n修改一下再试？`,
          },
        ])
      }
    } catch {
      setMessages(prev => [
        ...prev.map(m =>
          m.functionCall
            ? { ...m, functionCall: { args: editArgs, status: 'pending' as const } }
            : m
        ),
        {
          id: `gm-neterr-${Date.now()}`,
          role: 'gm',
          content: '网络波动，再试一次？',
        },
      ])
    } finally {
      setRegistering(false)
    }
  }

  /* ─── Auth guards ─── */

  if (authLoading) {
    return (
      <div className="min-h-screen">
        <Header activeNav="developer" />
        <div className="flex items-center justify-center py-32">
          <div className="text-orange-500 text-lg">加载中...</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen">
        <Header activeNav="developer" />
        <div className="flex flex-col items-center justify-center py-32 gap-6">
          <p className="text-gray-500 text-lg">登录后才能注册应用</p>
          <Link href="/api/auth/login" className="cyber-btn text-sm">登录</Link>
        </div>
      </div>
    )
  }

  /* ─── Render ─── */

  return (
    <div className="min-h-screen flex flex-col">
      <Header activeNav="developer" />

      {/* Chat header bar */}
      <div className="border-b border-[#E8E0D8] bg-white/80 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GMAvatar />
            <div>
              <p className="text-sm font-bold text-gray-800">A2A 智选日报 · GM</p>
              <p className="text-xs text-gray-400">应用注册通道</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-gray-400">在线</span>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
          {/* Protocol hint */}
          <div className="text-center">
            <span className="inline-block px-3 py-1 bg-gray-100 text-gray-400 text-[11px] rounded-full">
              A2A 协议 · PA → GM 通信已建立
            </span>
          </div>

          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'pa' ? 'flex-row-reverse' : ''}`}
            >
              {msg.role === 'gm' ? <GMAvatar /> : <PAAvatar user={user} />}

              <div className={`max-w-[80%] min-w-0 ${msg.role === 'pa' ? 'items-end' : 'items-start'} flex flex-col`}>
                <p className={`text-[11px] mb-1 font-semibold ${
                  msg.role === 'gm' ? 'text-orange-400' : 'text-blue-400'
                }`}>
                  {msg.role === 'gm' ? 'GM' : `${user.name || 'PA'} · PA`}
                </p>

                <div
                  className={`inline-block px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'gm'
                      ? 'bg-white border border-[#E8E0D8] text-gray-700 rounded-tl-sm'
                      : 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white rounded-tr-sm shadow-sm shadow-blue-200/40'
                  }`}
                >
                  {msg.content}
                </div>

                {/* Function call card */}
                {msg.functionCall && (
                  <FunctionCallCard
                    args={editArgs || msg.functionCall.args}
                    status={msg.functionCall.status}
                    onEdit={setEditArgs}
                    onConfirm={confirm}
                    confirming={registering}
                  />
                )}

                {/* Success link */}
                {msg.resultId && (
                  <div className="mt-3 flex gap-3">
                    <Link
                      href={`/app-pa/${msg.resultId}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-orange-50 border border-orange-200 rounded-xl text-sm font-semibold text-orange-600 hover:bg-orange-100 transition-colors"
                    >
                      前往应用主页 →
                    </Link>
                    <Link
                      href="/developer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
                    >
                      开发者中心
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
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
      </div>

      {/* Input area */}
      {phase !== 'done' ? (
        <div className="border-t border-[#E8E0D8] bg-white/90 backdrop-blur-sm">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <div className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) send()
                }}
                placeholder={
                  phase === 'reviewing'
                    ? '还想补充什么？或直接在上方确认'
                    : '描述你的应用...'
                }
                disabled={processing}
                className="flex-1 px-4 py-3 bg-[#FFFBF5] border border-[#E8E0D8] rounded-xl text-sm text-gray-800
                  focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all
                  disabled:opacity-50 placeholder:text-gray-300"
              />
              <button
                onClick={send}
                disabled={!input.trim() || processing}
                className="px-5 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl text-sm font-semibold
                  hover:shadow-lg hover:shadow-blue-200/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
              >
                发送
              </button>
            </div>
            <p className="text-[11px] text-gray-300 mt-2 text-center">
              以 PA 身份与 GM 对话 · 注册你的 A2A 应用
            </p>
          </div>
        </div>
      ) : (
        <div className="border-t border-[#E8E0D8] bg-white/90 backdrop-blur-sm">
          <div className="max-w-2xl mx-auto px-4 py-4 text-center">
            <p className="text-sm text-gray-400">对话结束 · 应用已注册</p>
          </div>
        </div>
      )}
    </div>
  )
}
