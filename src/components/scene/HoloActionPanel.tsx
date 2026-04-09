'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

interface ActionOption {
  id: string
  label: string
  icon?: string
  outcome?: 'stay' | 'move'
}

interface HoloActionPanelProps {
  actions: ActionOption[]
  onAction: (label: string) => void
  onFreeInput: (text: string) => void
  disabled?: boolean
}

export default function HoloActionPanel({
  actions,
  onAction,
  onFreeInput,
  disabled = false,
}: HoloActionPanelProps) {
  const t = useTranslations('agentSpace')
  const [input, setInput] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || disabled) return
    onFreeInput(input.trim())
    setInput('')
  }

  return (
    <div className="holo-actions">
      {actions.length > 0 && !disabled && (
        <div className="holo-actions__cards">
          {actions.map(action => (
            <button
              key={action.id}
              className="holo-actions__card"
              onClick={() => onAction(action.label)}
              disabled={disabled}
            >
              {action.icon && <span className="holo-actions__card-icon">{action.icon}</span>}
              <span className="holo-actions__card-label">{action.label}</span>
              {action.outcome === 'move' && <span className="holo-actions__card-arrow">→</span>}
            </button>
          ))}
        </div>
      )}

      <form className="holo-actions__input-row" onSubmit={handleSubmit}>
        <input
          type="text"
          className="holo-actions__input"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={t('holoAction.freeInputPlaceholder')}
          disabled={disabled}
        />
        <button
          type="submit"
          className="holo-actions__send"
          disabled={disabled || !input.trim()}
        >
          SEND
        </button>
      </form>
    </div>
  )
}
