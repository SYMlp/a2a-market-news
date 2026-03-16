'use client'

import { useState, useRef, useEffect } from 'react'
import SpeechBubble from './SpeechBubble'

export interface ChatMessage {
  role: 'agent' | 'pa'
  text: string
  thinking?: { intent: string; confidence: number }
  functionCall?: { name: string; args: Record<string, unknown>; status: string }
}

interface SceneOption {
  id: string
  label: string
  icon?: string
}

interface ManualPanelProps {
  messages: ChatMessage[]
  sceneLabel: string
  agentName: string
  agentEmoji: string
  accent: string
  options: SceneOption[]
  onSend: (text: string) => void
  processing: boolean
}

export default function ManualPanel({
  messages, sceneLabel, agentName, agentEmoji, accent, options, onSend, processing,
}: ManualPanelProps) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleChoice = (label: string) => {
    if (processing) return
    onSend(label)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || processing) return
    onSend(input.trim())
    setInput('')
  }

  return (
    <div className="manual-panel" style={{ '--lobby-accent': accent } as React.CSSProperties}>
      {/* Scene header */}
      <div className="manual-panel__head">
        <span className="manual-panel__scene-icon">{agentEmoji}</span>
        <span className="manual-panel__scene-label">{sceneLabel}</span>
        <span className="manual-panel__agent-name">{agentName}</span>
      </div>

      {/* Conversation area */}
      <div className="manual-panel__chat">
        {/* Agent character */}
        <div className="manual-panel__agent">
          <div className="char-avatar char-avatar--agent" style={{ '--char-accent': accent } as React.CSSProperties}>
            <span className="char-avatar__emoji">{agentEmoji}</span>
          </div>
          <span className="char-avatar__name">{agentName}</span>
        </div>

        {/* Messages */}
        <div className="manual-panel__msgs">
          {messages.map((msg, i) => (
            <div key={i} className={`manual-msg manual-msg--${msg.role}`}>
              {msg.role === 'agent' ? (
                <SpeechBubble
                  text={msg.text}
                  side="left"
                  accent={accent}
                  instant={i < messages.length - 1}
                />
              ) : (
                <div className="manual-msg__pa-bubble">{msg.text}</div>
              )}
              {msg.functionCall && (
                <div className="manual-msg__fn">
                  <span className="manual-msg__fn-icon">⚡</span>
                  {msg.functionCall.name}
                </div>
              )}
            </div>
          ))}
          {processing && (
            <div className="manual-msg manual-msg--agent">
              <div className="sb sb--left sb--typing" style={{ '--sb-accent': accent } as React.CSSProperties}>
                <div className="sb__body"><span className="sb__dots"><i /><i /><i /></span></div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Choice cards */}
      {options.length > 0 && !processing && (
        <div className="manual-panel__choices">
          {options.map((opt) => (
            <button
              key={opt.id}
              className="choice-card"
              onClick={() => handleChoice(opt.label)}
              style={{ '--lobby-accent': accent } as React.CSSProperties}
            >
              {opt.icon && <span className="choice-card__icon">{opt.icon}</span>}
              <span className="choice-card__label">{opt.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Free input */}
      <form className="manual-panel__input" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="或者直接告诉我你想做什么..."
          disabled={processing}
          className="manual-panel__field"
        />
        <button type="submit" disabled={processing || !input.trim()} className="manual-panel__send">
          发送
        </button>
      </form>
    </div>
  )
}
