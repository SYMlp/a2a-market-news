'use client'

import type { ReactNode } from 'react'
import SceneBackground from './SceneBackground'

interface SceneShellProps {
  scene: string
  accentRgb: string
  particleCount?: number
  children: ReactNode
}

export default function SceneShell({
  scene,
  accentRgb,
  particleCount = 20,
  children,
}: SceneShellProps) {
  return (
    <div
      className="scene-shell"
      data-scene={scene}
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

      {/* Corner frame */}
      <svg className="scene-shell__frame" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M0,5 L0,0 L5,0" className="scene-shell__frame-edge" />
        <path d="M95,0 L100,0 L100,5" className="scene-shell__frame-edge" />
        <path d="M100,95 L100,100 L95,100" className="scene-shell__frame-edge" />
        <path d="M5,100 L0,100 L0,95" className="scene-shell__frame-edge" />
      </svg>

      {/* Content */}
      <div className="scene-shell__content">
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
