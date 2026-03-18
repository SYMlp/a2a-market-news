'use client'

import { useState, useEffect } from 'react'

export type GameMode = 'advisor' | 'auto' | 'manual'

interface TownApproachProps {
  onModeSelect: (mode: GameMode) => void
  paName: string
}

type ApproachPhase = 'walking' | 'arrived' | 'door_open' | 'choosing' | 'chosen'

export default function TownApproach({ onModeSelect, paName }: TownApproachProps) {
  const [phase, setPhase] = useState<ApproachPhase>('walking')
  const [chosenMode, setChosenMode] = useState<GameMode | null>(null)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('arrived'), 3200)
    const t2 = setTimeout(() => setPhase('door_open'), 3600)
    const t3 = setTimeout(() => setPhase('choosing'), 4500)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  const handleChoose = (mode: GameMode) => {
    if (phase === 'chosen') return
    setChosenMode(mode)
    setPhase('chosen')
    setTimeout(() => onModeSelect(mode), 900)
  }

  return (
    <div className={`town ${phase === 'chosen' ? 'town--exit' : ''}`}>
      {/* Sky */}
      <div className="town__sky">
        {Array.from({ length: 30 }).map((_, i) => (
          <span key={i} className="town__star" style={starStyle(i)} />
        ))}
      </div>

      {/* Cityscape silhouettes */}
      <div className="town__cityscape">
        <div className="town__bldg town__bldg--1" />
        <div className="town__bldg town__bldg--2" />
        <div className="town__bldg town__bldg--3" />
        <div className="town__bldg town__bldg--4" />
        {/* The newsroom building */}
        <div className="town__newsroom">
          <div className="town__newsroom-sign">A2A</div>
          <div className={`town__newsroom-door ${phase === 'door_open' || phase === 'choosing' || phase === 'chosen' ? 'town__newsroom-door--open' : ''}`}>
            <div className="town__newsroom-door-light" />
          </div>
          <div className="town__newsroom-window town__newsroom-window--1" />
          <div className="town__newsroom-window town__newsroom-window--2" />
          <div className="town__newsroom-glow" />
        </div>
      </div>

      {/* Street */}
      <div className="town__street">
        <div className="town__sidewalk" />
        <div className="town__road" />
        <div className="town__road-line" />
        <div className="town__lamp town__lamp--1">
          <div className="town__lamp-post" />
          <div className="town__lamp-light" />
        </div>
        <div className="town__lamp town__lamp--2">
          <div className="town__lamp-post" />
          <div className="town__lamp-light" />
        </div>
      </div>

      {/* PA character walking */}
      <div className={`town__pa town__pa--${phase}`}>
        <div className="town__pa-name">{paName}</div>
        <div className="town__pa-sprite">
          <img
            src="/sprites/pa.png"
            alt={paName}
            className="town__pa-img"
            draggable={false}
          />
        </div>
        <div className="town__pa-shadow" />
      </div>

      {/* Mode selection cards */}
      {(phase === 'choosing' || phase === 'chosen') && (
        <div className="town__choices">
          <button
            className={`town__choice ${chosenMode === 'advisor' ? 'town__choice--chosen' : ''} ${chosenMode && chosenMode !== 'advisor' ? 'town__choice--dimmed' : ''}`}
            onClick={() => handleChoose('advisor')}
          >
            <div className="town__choice-icon">💬</div>
            <div className="town__choice-name">指导 PA</div>
            <div className="town__choice-desc">给 PA 建议，TA 自己说</div>
            <div className="town__choice-tag">ADVISOR</div>
          </button>
          <button
            className={`town__choice town__choice--delay ${chosenMode === 'auto' ? 'town__choice--chosen' : ''} ${chosenMode && chosenMode !== 'auto' ? 'town__choice--dimmed' : ''}`}
            onClick={() => handleChoose('auto')}
          >
            <div className="town__choice-icon">🤖</div>
            <div className="town__choice-name">PA 自动</div>
            <div className="town__choice-desc">PA 自主探索</div>
            <div className="town__choice-tag">AUTO</div>
          </button>
          <button
            className={`town__choice town__choice--delay2 ${chosenMode === 'manual' ? 'town__choice--chosen' : ''} ${chosenMode && chosenMode !== 'manual' ? 'town__choice--dimmed' : ''}`}
            onClick={() => handleChoose('manual')}
          >
            <div className="town__choice-icon">🎮</div>
            <div className="town__choice-name">直接操控</div>
            <div className="town__choice-desc">你来选择操作</div>
            <div className="town__choice-tag">MANUAL</div>
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
