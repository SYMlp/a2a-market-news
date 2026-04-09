'use client'

import { useTranslations } from 'next-intl'
import { SCENE_CONFIG } from '@/lib/scene-visuals'

const SCENE_ORDER = ['lobby', 'news', 'developer'] as const

type GameMode = 'advisor' | 'auto' | 'manual'

interface NavigationHUDProps {
  currentScene: string
  mode: GameMode | null
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
  const t = useTranslations('agentSpace.navigation')
  const ts = useTranslations('agentSpace')
  const sceneLabel = (id: string) => {
    if (id === 'lobby') return ts('scenes.lobby.label')
    if (id === 'news') return ts('scenes.news.label')
    if (id === 'developer') return ts('scenes.developer.label')
    return (SCENE_CONFIG[id] || SCENE_CONFIG.lobby).label
  }
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
              <span>{sceneLabel(id)}</span>
            </button>
          )
        })}
      </div>

      <div className="nav-hud__divider" />

      <div className="nav-hud__right">
        <a
          href="/portal"
          target="_blank"
          rel="noopener noreferrer"
          className="nav-hud__portal"
          title={t('portalTitle')}
        >
          🌐 <span>{t('humanView')}</span>
        </a>

        <button
          className="nav-hud__back"
          onClick={onBack}
          disabled={!canGoBack}
        >
          ← {t('back')}
        </button>

        {mode && (
          <button className="nav-hud__mode" onClick={onModeToggle}>
            <span className="nav-hud__mode-dot" />
            <span className="nav-hud__mode-label">
              {mode === 'auto' ? t('modeAuto') : mode === 'advisor' ? t('modeAdvisor') : t('modeManual')}
            </span>
          </button>
        )}
      </div>
    </nav>
  )
}
