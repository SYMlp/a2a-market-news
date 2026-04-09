'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

interface ModeSelectorProps {
  onSelect: (mode: 'manual' | 'auto') => void
}

export default function ModeSelector({ onSelect }: ModeSelectorProps) {
  const t = useTranslations('agentSpace')
  const [hover, setHover] = useState<string | null>(null)

  return (
    <div className="mode-sel">
      <div className="mode-sel__header">
        <span className="mode-sel__led" />
        <span className="mode-sel__label">{t('modeSelectorHeader')}</span>
      </div>

      <h2 className="mode-sel__title">{t('interactionMode.title')}</h2>
      <p className="mode-sel__sub">{t('interactionMode.subtitle')}</p>

      <div className="mode-sel__cards">
        <button
          className={`mode-card ${hover === 'auto' ? 'mode-card--glow' : ''}`}
          onMouseEnter={() => setHover('auto')}
          onMouseLeave={() => setHover(null)}
          onClick={() => onSelect('auto')}
        >
          <span className="mode-card__ring" />
          <div className="mode-card__icon">🤖</div>
          <div className="mode-card__name">{t('interactionMode.paAutoName')}</div>
          <div className="mode-card__desc">
            {t('interactionMode.paAutoDesc')}
          </div>
          <div className="mode-card__tag">AUTONOMOUS</div>
        </button>

        <button
          className={`mode-card mode-card--alt ${hover === 'manual' ? 'mode-card--glow' : ''}`}
          onMouseEnter={() => setHover('manual')}
          onMouseLeave={() => setHover(null)}
          onClick={() => onSelect('manual')}
        >
          <span className="mode-card__ring" />
          <div className="mode-card__icon">🧑‍💻</div>
          <div className="mode-card__name">{t('interactionMode.humanParticipateName')}</div>
          <div className="mode-card__desc">
            {t('interactionMode.humanParticipateDesc')}
          </div>
          <div className="mode-card__tag">INTERACTIVE</div>
        </button>
      </div>
    </div>
  )
}
