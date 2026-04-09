'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

interface MistOverlayProps {
  onSelect: (mode: 'manual' | 'auto') => void
}

export default function MistOverlay({ onSelect }: MistOverlayProps) {
  const t = useTranslations('agentSpace')
  const [exiting, setExiting] = useState(false)

  const handleSelect = (mode: 'manual' | 'auto') => {
    if (exiting) return
    setExiting(true)
    setTimeout(() => onSelect(mode), 500)
  }

  return (
    <div className={`mist-overlay ${exiting ? 'mist-overlay--exit' : ''}`}>
      <div className="mist-overlay__fog" />

      <div className="mist-overlay__content">
        <h2 className="mist-overlay__title">{t('interactionMode.title')}</h2>
        <p className="mist-overlay__sub">{t('interactionMode.subtitle')}</p>

        <div className="mist-overlay__cards">
          <button
            className="mist-overlay__card"
            onClick={() => handleSelect('auto')}
          >
            <div className="mist-overlay__card-icon">🤖</div>
            <div className="mist-overlay__card-name">{t('interactionMode.paAutoName')}</div>
            <div className="mist-overlay__card-desc">
              {t('interactionMode.paAutoDesc')}
            </div>
            <div className="mist-overlay__card-tag">AUTONOMOUS</div>
          </button>

          <button
            className="mist-overlay__card"
            onClick={() => handleSelect('manual')}
          >
            <div className="mist-overlay__card-icon">🧑‍💻</div>
            <div className="mist-overlay__card-name">{t('interactionMode.humanControlName')}</div>
            <div className="mist-overlay__card-desc">
              {t('interactionMode.humanControlDesc')}
            </div>
            <div className="mist-overlay__card-tag">INTERACTIVE</div>
          </button>
        </div>
      </div>
    </div>
  )
}
