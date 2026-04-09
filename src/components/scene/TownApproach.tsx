'use client'

import Image from 'next/image'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import SpriteAnimation from './SpriteAnimation'
import type { SpriteSheet } from './SpriteAnimation'

export type GameMode = 'advisor' | 'auto' | 'manual'

interface TownApproachProps {
  onModeSelect: (mode: GameMode) => void
  paName: string
}

type ApproachPhase =
  | 'walking'
  | 'arrived'
  | 'door_open'
  | 'choosing'
  | 'chosen'
  | 'portal_spawning'
  | 'pa_entering'

const PA_RUN_SHEET: SpriteSheet = {
  src: '/sprites/characters/pa-run-strip.png',
  frameCount: 4,
  frameWidth: 60,
  frameHeight: 92,
}

export default function TownApproach({ onModeSelect, paName }: TownApproachProps) {
  const t = useTranslations('agentSpace')
  const [phase, setPhase] = useState<ApproachPhase>('walking')
  const [chosenMode, setChosenMode] = useState<GameMode | null>(null)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('arrived'), 5200)
    const t2 = setTimeout(() => setPhase('door_open'), 5600)
    const t3 = setTimeout(() => setPhase('choosing'), 6500)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  const handleChoose = (mode: GameMode) => {
    if (phase === 'chosen' || phase === 'portal_spawning' || phase === 'pa_entering') return
    setChosenMode(mode)
    setPhase('chosen')

    setTimeout(() => setPhase('portal_spawning'), 600)
    setTimeout(() => setPhase('pa_entering'), 1400)
    setTimeout(() => onModeSelect(mode), 2800)
  }

  const showChoices = phase === 'choosing' || phase === 'chosen'
  const showPortal = phase === 'portal_spawning' || phase === 'pa_entering'
  const isRunning = phase === 'walking' || phase === 'pa_entering'

  return (
    <div className={`town ${phase === 'pa_entering' ? 'town--entering' : ''}`}>
      <Image
        src="/sprites/backgrounds/city-street-bg.png"
        alt=""
        width={1920}
        height={1080}
        className="town__bg-img"
        draggable={false}
      />
      <div className="town__bg-overlay" />

      <div className="town__sky">
        {Array.from({ length: 30 }).map((_, i) => (
          <span key={i} className="town__star" style={starStyle(i)} />
        ))}
      </div>

      {/* PA character */}
      <div className={`town__pa town__pa--${phase}`}>
        <div className="town__pa-name">{paName}</div>
        <div className={`town__pa-sprite ${isRunning ? 'town__pa-sprite--run' : 'town__pa-sprite--idle'}`}>
          {isRunning ? (
            <SpriteAnimation
              sheet={PA_RUN_SHEET}
              width={72}
              speed={0.5}
              direction="right"
            />
          ) : (
            <Image
              src="/sprites/pa.png"
              alt={paName}
              width={72}
              height={72}
              className="town__pa-img"
              draggable={false}
            />
          )}
        </div>
        <div className="town__pa-shadow" />
      </div>

      {/* Portal */}
      {showPortal && (
        <div className={`town__portal town__portal--${phase}`}>
          <div className="town__portal-glow" />
          <div className="town__portal-ring town__portal-ring--1" />
          <div className="town__portal-ring town__portal-ring--2" />
          <div className="town__portal-ring town__portal-ring--3" />
          <div className="town__portal-core" />
        </div>
      )}

      {/* Mode selection cards */}
      {showChoices && (
        <div className={`town__choices ${phase === 'chosen' ? 'town__choices--exit' : ''}`}>
          <button
            className={`town__choice ${chosenMode === 'advisor' ? 'town__choice--chosen' : ''} ${chosenMode && chosenMode !== 'advisor' ? 'town__choice--dimmed' : ''}`}
            onClick={() => handleChoose('advisor')}
          >
            <div className="town__choice-icon">💬</div>
            <div className="town__choice-name">{t('townApproach.advisorName')}</div>
            <div className="town__choice-desc">{t('townApproach.advisorDesc')}</div>
            <div className="town__choice-tag">{t('townApproach.advisorTag')}</div>
          </button>
          <button
            className={`town__choice town__choice--delay ${chosenMode === 'auto' ? 'town__choice--chosen' : ''} ${chosenMode && chosenMode !== 'auto' ? 'town__choice--dimmed' : ''}`}
            onClick={() => handleChoose('auto')}
          >
            <div className="town__choice-icon">🤖</div>
            <div className="town__choice-name">{t('townApproach.autoName')}</div>
            <div className="town__choice-desc">{t('townApproach.autoDesc')}</div>
            <div className="town__choice-tag">{t('townApproach.autoTag')}</div>
          </button>
          <button
            className={`town__choice town__choice--delay2 ${chosenMode === 'manual' ? 'town__choice--chosen' : ''} ${chosenMode && chosenMode !== 'manual' ? 'town__choice--dimmed' : ''}`}
            onClick={() => handleChoose('manual')}
          >
            <div className="town__choice-icon">🎮</div>
            <div className="town__choice-name">{t('townApproach.manualName')}</div>
            <div className="town__choice-desc">{t('townApproach.manualDesc')}</div>
            <div className="town__choice-tag">{t('townApproach.manualTag')}</div>
          </button>
        </div>
      )}
    </div>
  )
}

function starStyle(i: number): React.CSSProperties {
  return {
    left: `${(i * 31 + 7) % 100}%`,
    top: `${(i * 17 + 3) % 45}%`,
    animationDelay: `${(i * 0.7) % 4}s`,
    animationDuration: `${2 + (i % 3)}s`,
    opacity: 0.3 + (i % 5) * 0.14,
  }
}
