'use client'

import Image from 'next/image'
import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { SCENE_CONFIG } from '@/lib/scene-visuals'
import type { SceneAchievement } from '@/lib/engine/types'

export interface SessionSummary {
  scenesVisited: string[]
  npcsMet: Array<{ name: string; emoji: string }>
  achievements: SceneAchievement[]
  totalTurns: number
}

interface TownFarewellProps {
  paName: string
  summary: SessionSummary
  onComplete: () => void
}

type FarewellPhase = 'door_closing' | 'walking_away' | 'summary' | 'done'

export default function TownFarewell({ paName, summary, onComplete }: TownFarewellProps) {
  const t = useTranslations('agentSpace')
  const sceneLabel = (sceneId: string, fallback: string) => {
    if (sceneId === 'lobby') return t('scenes.lobby.label')
    if (sceneId === 'news') return t('scenes.news.label')
    if (sceneId === 'developer') return t('scenes.developer.label')
    return fallback
  }
  const [phase, setPhase] = useState<FarewellPhase>('door_closing')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('walking_away'), 800)
    const t2 = setTimeout(() => setPhase('summary'), 3600)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const handleDismiss = useCallback(() => {
    if (phase !== 'summary') return
    setPhase('done')
    setTimeout(onComplete, 800)
  }, [phase, onComplete])

  useEffect(() => {
    if (phase !== 'summary') return
    const autoClose = setTimeout(() => {
      setPhase('done')
      setTimeout(onComplete, 800)
    }, 8000)
    return () => clearTimeout(autoClose)
  }, [phase, onComplete])

  const uniqueScenes = [...new Set(summary.scenesVisited)].filter(s => s !== 'lobby')
  const uniqueNpcs = summary.npcsMet.reduce<Array<{ name: string; emoji: string }>>((acc, n) => {
    if (!acc.find(x => x.name === n.name)) acc.push(n)
    return acc
  }, [])

  return (
    <div className={`town town-farewell ${phase === 'done' ? 'town--exit' : ''}`}>
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
        <div className="town__newsroom">
          <div className="town__newsroom-sign">A2A</div>
          <div className={`town__newsroom-door ${phase === 'door_closing' ? 'town__newsroom-door--open' : ''}`}>
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

      {/* PA walking away */}
      <div className={`town__pa town-fw__pa town-fw__pa--${phase}`}>
        <div className="town__pa-name">{paName}</div>
        <div className="town__pa-sprite town-fw__pa-sprite">
          <Image
            src="/sprites/pa.png"
            alt={paName}
            width={72}
            height={72}
            className="town__pa-img town-fw__pa-img"
            draggable={false}
          />
        </div>
        <div className="town__pa-shadow" />
      </div>

      {/* Summary card */}
      {(phase === 'summary' || phase === 'done') && (
        <div
          className="town-fw__card"
          onClick={handleDismiss}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleDismiss() }}
        >
          <div className="town-fw__card-inner">
            <div className="town-fw__card-header">
              <span className="town-fw__card-wave">👋</span>
              <h2 className="town-fw__card-title">{t('townFarewell.title')}</h2>
              <p className="town-fw__card-sub">{t('townFarewell.subtitle')}</p>
            </div>

            <div className="town-fw__card-body">
              {uniqueScenes.length > 0 && (
                <div className="town-fw__section">
                  <div className="town-fw__section-label">🗺️ {t('townFarewell.scenesVisited')}</div>
                  <div className="town-fw__tags">
                    {uniqueScenes.map(sceneId => {
                      const cfg = SCENE_CONFIG[sceneId] || SCENE_CONFIG.lobby
                      const label = sceneLabel(sceneId, cfg.label)
                      return (
                        <span key={sceneId} className="town-fw__tag">
                          <span className="town-fw__tag-icon">{cfg.icon}</span>
                          {label}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              {uniqueNpcs.length > 0 && (
                <div className="town-fw__section">
                  <div className="town-fw__section-label">🤝 {t('townFarewell.charactersMet')}</div>
                  <div className="town-fw__tags">
                    {uniqueNpcs.map(npc => (
                      <span key={npc.name} className="town-fw__tag">
                        <span className="town-fw__tag-icon">{npc.emoji}</span>
                        {npc.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {summary.achievements.length > 0 && (
                <div className="town-fw__section">
                  <div className="town-fw__section-label">🏆 {t('townFarewell.achievements')}</div>
                  <div className="town-fw__achievements">
                    {summary.achievements.map((a, i) => (
                      <div key={`${a.actionId}-${i}`} className="town-fw__achievement">
                        <span className="town-fw__achievement-dot" />
                        {a.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="town-fw__section town-fw__section--stat">
                <div className="town-fw__stat">
                  <span className="town-fw__stat-number">{summary.totalTurns}</span>
                  <span className="town-fw__stat-label">{t('townFarewell.statTurns')}</span>
                </div>
                <div className="town-fw__stat">
                  <span className="town-fw__stat-number">{uniqueScenes.length + 1}</span>
                  <span className="town-fw__stat-label">{t('townFarewell.statScenes')}</span>
                </div>
                <div className="town-fw__stat">
                  <span className="town-fw__stat-number">{summary.achievements.length}</span>
                  <span className="town-fw__stat-label">{t('townFarewell.statAchievements')}</span>
                </div>
              </div>
            </div>

            <div className="town-fw__card-footer">
              <span className="town-fw__card-hint">{t('townFarewell.tapToContinue')}</span>
            </div>
          </div>
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
