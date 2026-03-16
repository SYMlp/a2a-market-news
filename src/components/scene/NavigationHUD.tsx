'use client'

import { SCENE_CONFIG } from '@/lib/gm/scene-config'

const SCENE_ORDER = ['lobby', 'news', 'developer'] as const

interface NavigationHUDProps {
  currentScene: string
  mode: 'manual' | 'auto' | null
  onNavigate: (sceneId: string) => void
  onBack: () => void
  onModeToggle: () => void
  canGoBack: boolean
}

export default function NavigationHUD({
  currentScene,
  mode,
  onNavigate,
  onBack,
  onModeToggle,
  canGoBack,
}: NavigationHUDProps) {
  return (
    <nav className="nav-hud">
      <div className="nav-hud__scenes">
        {SCENE_ORDER.map(id => {
          const cfg = SCENE_CONFIG[id]
          const active = currentScene === id
          return (
            <button
              key={id}
              className={`nav-hud__scene-btn ${active ? 'nav-hud__scene-btn--active' : ''}`}
              onClick={() => !active && onNavigate(id)}
            >
              <span className="nav-hud__scene-icon">{cfg.icon}</span>
              <span>{cfg.label}</span>
            </button>
          )
        })}
      </div>

      <div className="nav-hud__divider" />

      <div className="nav-hud__right">
        <button
          className="nav-hud__back"
          onClick={onBack}
          disabled={!canGoBack}
        >
          ← BACK
        </button>

        {mode && (
          <button className="nav-hud__mode" onClick={onModeToggle}>
            <span className="nav-hud__mode-dot" />
            <span className="nav-hud__mode-label">
              {mode === 'auto' ? 'AI AUTO' : 'MANUAL'}
            </span>
          </button>
        )}
      </div>
    </nav>
  )
}
