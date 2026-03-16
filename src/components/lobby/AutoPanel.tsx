'use client'

import { useRef, useEffect } from 'react'
import SpeechBubble from './SpeechBubble'
import type { ChatMessage } from './ManualPanel'

interface AutoPanelProps {
  messages: ChatMessage[]
  sceneLabel: string
  agentName: string
  agentEmoji: string
  paName: string
  accent: string
  processing: boolean
  autoStep: 'idle' | 'agent_speaking' | 'pa_thinking' | 'pa_speaking' | 'sending'
  paused: boolean
  onPauseToggle: () => void
  onBubbleComplete: () => void
}

export default function AutoPanel({
  messages, sceneLabel, agentName, agentEmoji, paName, accent,
  processing, autoStep, paused, onPauseToggle, onBubbleComplete,
}: AutoPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const lastMsg = messages[messages.length - 1]

  return (
    <div className="auto-panel" style={{ '--lobby-accent': accent } as React.CSSProperties}>
      {/* Scene header */}
      <div className="auto-panel__head">
        <span>{agentEmoji} {sceneLabel}</span>
        <button className={`auto-panel__pause ${paused ? 'auto-panel__pause--on' : ''}`} onClick={onPauseToggle}>
          {paused ? '▶ 继续' : '⏸ 暂停'}
        </button>
      </div>

      {/* Stage: two characters facing each other */}
      <div className="auto-panel__stage">
        {/* PA character (left) */}
        <div className="auto-panel__char auto-panel__char--left">
          <div className="char-avatar char-avatar--pa" style={{ '--char-accent': '#3b82f6' } as React.CSSProperties}>
            <span className="char-avatar__emoji">🧑</span>
          </div>
          <span className="char-avatar__name">{paName}</span>
          {autoStep === 'pa_thinking' && (
            <div className="thinking-overlay">
              <div className="thinking-overlay__pulse" />
              <div className="thinking-overlay__label">思考中...</div>
              {lastMsg?.role === 'agent' && (
                <div className="thinking-overlay__detail">分析 GM 消息</div>
              )}
            </div>
          )}
        </div>

        {/* Center conversation flow */}
        <div className="auto-panel__flow">
          {messages.map((msg, i) => (
            <div key={i} className={`auto-msg auto-msg--${msg.role}`}>
              <SpeechBubble
                text={msg.text}
                side={msg.role === 'agent' ? 'right' : 'left'}
                accent={msg.role === 'agent' ? accent : '#3b82f6'}
                instant={i < messages.length - 1}
                onComplete={i === messages.length - 1 ? onBubbleComplete : undefined}
              />
              {msg.thinking && (
                <div className="auto-msg__thinking">
                  <span className="auto-msg__thinking-tag">INTENT</span>
                  <span className="auto-msg__thinking-val">{msg.thinking.intent}</span>
                  <span className="auto-msg__thinking-conf">
                    {Math.round(msg.thinking.confidence * 100)}%
                  </span>
                </div>
              )}
              {msg.functionCall && (
                <div className="auto-msg__fn">
                  ⚡ {msg.functionCall.name}
                </div>
              )}
            </div>
          ))}
          {(autoStep === 'pa_thinking' || autoStep === 'sending') && (
            <div className="auto-msg auto-msg--system">
              <div className="auto-msg__loader">
                <i /><i /><i />
              </div>
              <span>{autoStep === 'pa_thinking' ? 'PA 思考中...' : '发送到 GM...'}</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Agent character (right) */}
        <div className="auto-panel__char auto-panel__char--right">
          <div className="char-avatar char-avatar--agent" style={{ '--char-accent': accent } as React.CSSProperties}>
            <span className="char-avatar__emoji">{agentEmoji}</span>
          </div>
          <span className="char-avatar__name">{agentName}</span>
        </div>
      </div>
    </div>
  )
}
