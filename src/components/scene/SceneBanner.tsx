'use client'

import { useTranslations } from 'next-intl'

interface SceneBannerProps {
  label: string
  icon: string
  npcName: string
  accentRgb: string
}

export default function SceneBanner({ label, icon, npcName, accentRgb }: SceneBannerProps) {
  const t = useTranslations('agentSpace')
  return (
    <div
      className="scene-banner"
      style={{ '--sb-rgb': accentRgb } as React.CSSProperties}
    >
      {/* Outer glow aura */}
      <div className="scene-banner__aura" />

      {/* Main frame */}
      <div className="scene-banner__plate">
        {/* Decorative horizontal circuit lines */}
        <div className="scene-banner__circuit scene-banner__circuit--left" />
        <div className="scene-banner__circuit scene-banner__circuit--right" />

        {/* Corner brackets */}
        <svg className="scene-banner__bracket scene-banner__bracket--tl" viewBox="0 0 24 24" fill="none">
          <path d="M1,12 L1,2 C1,1.5 1.5,1 2,1 L12,1" stroke={`rgba(${accentRgb},0.9)`} strokeWidth="1.5" />
          <circle cx="12" cy="1" r="1.5" fill={`rgba(${accentRgb},0.6)`} />
        </svg>
        <svg className="scene-banner__bracket scene-banner__bracket--tr" viewBox="0 0 24 24" fill="none">
          <path d="M23,12 L23,2 C23,1.5 22.5,1 22,1 L12,1" stroke={`rgba(${accentRgb},0.9)`} strokeWidth="1.5" />
          <circle cx="12" cy="1" r="1.5" fill={`rgba(${accentRgb},0.6)`} />
        </svg>
        <svg className="scene-banner__bracket scene-banner__bracket--bl" viewBox="0 0 24 24" fill="none">
          <path d="M1,12 L1,22 C1,22.5 1.5,23 2,23 L12,23" stroke={`rgba(${accentRgb},0.9)`} strokeWidth="1.5" />
          <circle cx="12" cy="23" r="1.5" fill={`rgba(${accentRgb},0.6)`} />
        </svg>
        <svg className="scene-banner__bracket scene-banner__bracket--br" viewBox="0 0 24 24" fill="none">
          <path d="M23,12 L23,22 C23,22.5 22.5,23 22,23 L12,23" stroke={`rgba(${accentRgb},0.9)`} strokeWidth="1.5" />
          <circle cx="12" cy="23" r="1.5" fill={`rgba(${accentRgb},0.6)`} />
        </svg>

        {/* Horizontal scan line animation */}
        <div className="scene-banner__scanline" />

        {/* Content */}
        <div className="scene-banner__content">
          <div className="scene-banner__icon-wrap">
            <span className="scene-banner__icon">{icon}</span>
            <div className="scene-banner__icon-ring" />
          </div>

          <h2 className="scene-banner__title">{label}</h2>

          <div className="scene-banner__divider">
            <span className="scene-banner__divider-dot" />
            <span className="scene-banner__divider-line" />
            <span className="scene-banner__divider-dot" />
          </div>

          <div className="scene-banner__npc">
            <span className="scene-banner__npc-indicator" />
            <span>{npcName}</span>
            <span className="scene-banner__npc-status">{t('sceneBanner.online')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
