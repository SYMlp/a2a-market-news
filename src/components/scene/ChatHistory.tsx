'use client'

import { useEffect, useRef, useState } from 'react'

export interface ChatMessage {
  id: string
  role: 'npc' | 'pa' | 'system'
  name: string
  text: string
  timestamp: number
}

interface ChatHistoryProps {
  messages: ChatMessage[]
  accentRgb: string
}

export default function ChatHistory({ messages, accentRgb }: ChatHistoryProps) {
  const [open, setOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(messages.length)

  useEffect(() => {
    if (messages.length > prevCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
    prevCountRef.current = messages.length
  }, [messages.length])

  const unread = !open && messages.length > 0

  return (
    <>
      <button
        className="chat-hist__toggle"
        onClick={() => setOpen(!open)}
        style={{ '--sc-accent-rgb': accentRgb } as React.CSSProperties}
      >
        <span className="chat-hist__toggle-icon">{open ? '✕' : '💬'}</span>
        {unread && <span className="chat-hist__badge">{messages.length}</span>}
      </button>

      <div
        className={`chat-hist__panel ${open ? 'chat-hist__panel--open' : ''}`}
        style={{ '--sc-accent-rgb': accentRgb } as React.CSSProperties}
      >
        <div className="chat-hist__header">
          <span className="chat-hist__title">对话记录</span>
          <span className="chat-hist__count">{messages.length} 条</span>
        </div>

        <div className="chat-hist__scroll" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="chat-hist__empty">暂无对话记录</div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`chat-hist__msg chat-hist__msg--${msg.role}`}
            >
              <div className="chat-hist__msg-head">
                <span className="chat-hist__msg-name">{msg.name}</span>
                <span className="chat-hist__msg-time">
                  {new Date(msg.timestamp).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="chat-hist__msg-text">{msg.text}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
