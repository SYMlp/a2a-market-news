'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

interface SpaceMiniWindowProps {
  variant: 'human-in-agent' | 'agent-in-human'
}

function HumanPreview() {
  return (
    <div className="space-mini__preview space-mini__preview--human">
      <div className="space-mini__preview-header">
        <div className="space-mini__preview-dot space-mini__preview-dot--r" />
        <div className="space-mini__preview-dot space-mini__preview-dot--y" />
        <div className="space-mini__preview-dot space-mini__preview-dot--g" />
        <span className="space-mini__preview-url">a2a-market.app/portal</span>
      </div>
      <div className="space-mini__preview-body space-mini__preview-body--human">
        <div className="space-mini__preview-nav" />
        <div className="space-mini__preview-hero">
          <div className="space-mini__preview-title-bar" />
          <div className="space-mini__preview-subtitle-bar" />
        </div>
        <div className="space-mini__preview-grid">
          <div className="space-mini__preview-card" />
          <div className="space-mini__preview-card" />
          <div className="space-mini__preview-card" />
          <div className="space-mini__preview-card" />
          <div className="space-mini__preview-card" />
          <div className="space-mini__preview-card" />
        </div>
      </div>
    </div>
  )
}

function AgentPreview() {
  return (
    <div className="space-mini__preview space-mini__preview--agent">
      <div className="space-mini__preview-scene">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className="space-mini__preview-particle"
            style={{ left: `${20 + i * 15}%`, top: `${15 + (i % 3) * 25}%`, animationDelay: `${i * 0.4}s` }}
          />
        ))}
        <div className="space-mini__preview-banner-mini" />
        <div className="space-mini__preview-npc" />
        <div className="space-mini__preview-pa" />
        <div className="space-mini__preview-bubble-a" />
        <div className="space-mini__preview-bubble-b" />
      </div>
    </div>
  )
}

export default function SpaceMiniWindow({ variant }: SpaceMiniWindowProps) {
  const t = useTranslations('agentSpace')
  const [collapsed, setCollapsed] = useState(false)

  const isHumanInAgent = variant === 'human-in-agent'
  const label = isHumanInAgent ? t('spaceMini.humanView') : t('spaceMini.agentSpace')
  const href = isHumanInAgent ? '/portal' : '/lobby'
  const icon = isHumanInAgent ? '🌐' : '🎮'

  if (collapsed) {
    return (
      <button
        className={`space-mini__collapsed space-mini__collapsed--${variant}`}
        onClick={() => setCollapsed(false)}
        title={t('spaceMini.expandPreview', { label })}
      >
        <span>{icon}</span>
      </button>
    )
  }

  return (
    <div className={`space-mini space-mini--${variant}`}>
      <div className="space-mini__header">
        <span className="space-mini__label">
          <span className="space-mini__status-dot" />
          {label}
        </span>
        <div className="space-mini__actions">
          <button
            className="space-mini__btn"
            onClick={() => setCollapsed(true)}
            title={t('spaceMini.collapse')}
          >
            −
          </button>
        </div>
      </div>

      <Link href={href} className="space-mini__body">
        {isHumanInAgent ? <HumanPreview /> : <AgentPreview />}
      </Link>

      <Link href={href} className="space-mini__enter">
        {t('spaceMini.switchTo', { label })}
      </Link>
    </div>
  )
}
