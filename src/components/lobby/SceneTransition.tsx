'use client'

import { useTranslations } from 'next-intl'
import { SCENE_CONFIG } from '@/lib/scene-visuals'

interface SceneTransitionProps {
  from: string
  to: string
}

export default function SceneTransition({ from, to }: SceneTransitionProps) {
  const t = useTranslations('agentSpace')
  const source = SCENE_CONFIG[from] || SCENE_CONFIG.lobby
  const target = SCENE_CONFIG[to] || SCENE_CONFIG.lobby
  const label = (id: string, fb: string) => {
    if (id === 'lobby') return t('scenes.lobby.label')
    if (id === 'news') return t('scenes.news.label')
    if (id === 'developer') return t('scenes.developer.label')
    return fb
  }

  return (
    <div className="scene-tr">
      <div className="scene-tr__bg" />
      <div className="scene-tr__content">
        <div className="scene-tr__icon">{target.agentEmoji}</div>
        <div className="scene-tr__label">
          <span className="scene-tr__gm">{t('sceneTransition.gmArranging')}</span>
          <span className="scene-tr__dest">{t('sceneTransition.fromTo', { from: label(from, source.label), to: label(to, target.label) })}</span>
        </div>
        <div className="scene-tr__bar">
          <div className="scene-tr__bar-fill" style={{ background: target.accent }} />
        </div>
      </div>
    </div>
  )
}
