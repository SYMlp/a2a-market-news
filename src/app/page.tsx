'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslations } from 'next-intl'

const CHAR_DELAY = 80

export default function LandingPage() {
  const t = useTranslations('landing')
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const TITLE = useMemo(() => t('title'), [t])
  const [phase, setPhase] = useState(0)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/portal')
      return
    }
  }, [user, authLoading, router])

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 1200 + TITLE.length * CHAR_DELAY + 600),
    ]
    return () => timers.forEach(clearTimeout)
  }, [TITLE])

  const handleEnter = useCallback(() => {
    if (exiting || authLoading) return
    setExiting(true)
    if (user) {
      setTimeout(() => router.push('/lobby'), 800)
    } else {
      setTimeout(() => { window.location.href = '/api/auth/login' }, 800)
    }
  }, [exiting, authLoading, user, router])

  return (
    <div className={`landing-page ${exiting ? 'landing-page--exit' : ''}`}>
      {/* Background layers */}
      <div className="landing-vignette" />
      <div className={`landing-grid ${phase >= 1 ? 'landing-grid--active' : ''}`} />
      <div className="landing-glow-orb" />
      <div className="landing-glow-orb landing-glow-orb--alt" />

      {/* Particles */}
      <div className="landing-particles" aria-hidden="true">
        {Array.from({ length: 25 }).map((_, i) => (
          <span key={i} className="landing-dot" style={getDotStyle(i)} />
        ))}
      </div>

      {/* Horizontal sweep beam */}
      <div className={`landing-sweep ${phase >= 2 ? 'landing-sweep--active' : ''}`} />

      {/* Scan lines */}
      <div className="landing-scan" />

      {/* Corner frame */}
      <svg className="landing-frame" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M0,6 L0,0 L6,0" className="landing-frame__edge" />
        <path d="M94,0 L100,0 L100,6" className="landing-frame__edge" />
        <path d="M100,94 L100,100 L94,100" className="landing-frame__edge" />
        <path d="M6,100 L0,100 L0,94" className="landing-frame__edge" />
      </svg>

      {/* Content */}
      <main className="landing-center">
        <div className={`landing-status ${phase >= 1 ? 'landing-status--on' : ''}`}>
          <span className="landing-status__led" />
          {t('systemOnline')}
        </div>

        <h1 className="landing-title" aria-label={TITLE}>
          {TITLE.split('').map((ch, i) => (
            <span
              key={i}
              className={`landing-char ${phase >= 2 ? 'landing-char--in' : ''}`}
              style={{ animationDelay: `${i * CHAR_DELAY}ms` }}
            >
              {ch}
            </span>
          ))}
        </h1>

        <div className={`landing-rule ${phase >= 3 ? 'landing-rule--on' : ''}`}>
          <span className="landing-rule__line" />
          <span className="landing-rule__gem" />
          <span className="landing-rule__line" />
        </div>

        <button
          className={`landing-cta ${phase >= 3 ? 'landing-cta--on' : ''}`}
          onClick={handleEnter}
        >
          <span className="landing-cta__glow" />
          <span className="landing-cta__ring" />
          <span className="landing-cta__label">{t('cta')}</span>
        </button>

        <div className={`landing-ver ${phase >= 3 ? 'landing-ver--on' : ''}`}>
          {t('version')}
        </div>
      </main>
    </div>
  )
}

function getDotStyle(i: number): React.CSSProperties {
  const x = (i * 37 + 7) % 97
  const y = (i * 53 + 13) % 97
  const size = 1.5 + (i % 3)
  return {
    left: `${x}%`,
    top: `${y}%`,
    animationDelay: `${(i * 0.4) % 10}s`,
    animationDuration: `${5 + (i % 5)}s`,
    '--dot-size': `${size}px`,
  } as React.CSSProperties
}
