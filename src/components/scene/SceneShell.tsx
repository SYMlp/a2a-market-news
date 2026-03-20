'use client'

import type { ReactNode } from 'react'
import SceneBackground from './SceneBackground'
import SceneBanner from './SceneBanner'

/** Plaque: static scene chrome, mounted with shell (same lifecycle as background). */
export interface ScenePlaqueProps {
  label: string
  icon: string
  npcName: string
}

interface SceneShellProps {
  scene: string
  accentRgb: string
  particleCount?: number
  /** Conversation-phase only; pinned overlay like background art */
  plaque?: ScenePlaqueProps | null
  /** Extra grid row for bottom item dock (card_deck) */
  dockActive?: boolean
  children: ReactNode
}

export default function SceneShell({
  scene,
  accentRgb,
  particleCount = 20,
  plaque = null,
  dockActive = false,
  children,
}: SceneShellProps) {
  return (
    <div
      className="scene-shell"
      data-scene={scene}
      data-plaque={plaque ? 'on' : 'off'}
      style={{ '--sc-accent-rgb': accentRgb } as React.CSSProperties}
    >
      {/* Per-scene background */}
      <SceneBackground scene={scene} />

      {/* Ambient particles overlay */}
      <div className="scene-shell__bg">
        <div className="scene-shell__particles" aria-hidden="true">
          {Array.from({ length: particleCount }).map((_, i) => (
            <span key={i} className="scene-shell__dot" style={dotStyle(i)} />
          ))}
        </div>
        <div className="scene-shell__scan" />
      </div>

      {/* Static plaque — scene-bound chrome, not in content grid */}
      {plaque && (
        <div className="scene-shell__plaque-layer">
          <SceneBanner
            label={plaque.label}
            icon={plaque.icon}
            npcName={plaque.npcName}
            accentRgb={accentRgb}
          />
        </div>
      )}

      {/* Corner frame */}
      <svg className="scene-shell__frame" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M0,5 L0,0 L5,0" className="scene-shell__frame-edge" />
        <path d="M95,0 L100,0 L100,5" className="scene-shell__frame-edge" />
        <path d="M100,95 L100,100 L95,100" className="scene-shell__frame-edge" />
        <path d="M5,100 L0,100 L0,95" className="scene-shell__frame-edge" />
      </svg>

      {/* Content */}
      <div
        className={`scene-shell__content${dockActive ? ' scene-shell__content--with-dock' : ''}`}
      >
        {children}
      </div>
    </div>
  )
}

function dotStyle(i: number): React.CSSProperties {
  const x = (i * 37 + 7) % 97
  const y = (i * 53 + 13) % 97
  const size = 1.5 + (i % 3)
  return {
    left: `${x}%`,
    top: `${y}%`,
    animationDelay: `${(i * 0.5) % 10}s`,
    animationDuration: `${5 + (i % 5)}s`,
    '--dot-size': `${size}px`,
  } as React.CSSProperties
}
