'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useProgressiveText } from '@/lib/ux/progressive-text'
import { formatTime } from '@/lib/format-date'

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
  isTyping?: boolean
  typingNpcName?: string
}

function ProgressiveMessage({ text }: { text: string }) {
  const { displayedText, isRevealing, revealAll } = useProgressiveText(text)
  return (
    <div className="chat-hist__msg-text" onClick={isRevealing ? revealAll : undefined}>
      {displayedText}
      {isRevealing && <span className="chat-hist__msg-cursor" />}
    </div>
  )
}

export default function ChatHistory({
  messages,
  accentRgb,
  isTyping,
  typingNpcName,
}: ChatHistoryProps) {
  const t = useTranslations('agentSpace')
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(messages.length)

  useEffect(() => {
    if (messages.length > prevCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
    prevCountRef.current = messages.length
  }, [messages.length])

  useEffect(() => {
    if (isTyping && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [isTyping])

  const unread = !open && messages.length > 0
  const lastMsg = messages[messages.length - 1]
  const isLastNpcFresh = lastMsg?.role === 'npc'

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
          <span className="chat-hist__title">{t('chatHistory.title')}</span>
          <span className="chat-hist__count">{t('chatHistory.messagesCount', { count: messages.length })}</span>
        </div>

        <div className="chat-hist__scroll" ref={scrollRef}>
          {messages.length === 0 && !isTyping && (
            <div className="chat-hist__empty">{t('chatHistory.empty')}</div>
          )}
          {messages.map((msg, i) => {
            const isLatestNpc = isLastNpcFresh && i === messages.length - 1
            return (
              <div
                key={msg.id}
                className={`chat-hist__msg chat-hist__msg--${msg.role}`}
              >
                <div className="chat-hist__msg-head">
                  <span className="chat-hist__msg-name">{msg.name}</span>
                  <span className="chat-hist__msg-time">
                    {formatTime(new Date(msg.timestamp), locale)}
                  </span>
                </div>
                {isLatestNpc ? (
                  <ProgressiveMessage text={msg.text} />
                ) : (
                  <div className="chat-hist__msg-text">{msg.text}</div>
                )}
              </div>
            )
          })}

          {isTyping && (
            <div className="chat-hist__msg chat-hist__msg--npc chat-hist__msg--typing">
              <div className="chat-hist__msg-head">
                <span className="chat-hist__msg-name">{typingNpcName || 'NPC'}</span>
              </div>
              <div className="chat-hist__msg-text">
                <span className="chat-hist__typing-dots">
                  <span /><span /><span />
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
