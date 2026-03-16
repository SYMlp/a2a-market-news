'use client'

import { SCENE_CONFIG } from '@/lib/gm/scene-config'

interface SceneTransitionProps {
  from: string
  to: string
}

export default function SceneTransition({ from, to }: SceneTransitionProps) {
  const target = SCENE_CONFIG[to] || SCENE_CONFIG.lobby

  return (
    <div className="scene-tr">
      <div className="scene-tr__bg" />
      <div className="scene-tr__content">
        <div className="scene-tr__icon">{target.agentEmoji}</div>
        <div className="scene-tr__label">
          <span className="scene-tr__gm">GM 灵枢兔正在安排...</span>
          <span className="scene-tr__dest">前往 {target.label}</span>
        </div>
        <div className="scene-tr__bar">
          <div className="scene-tr__bar-fill" style={{ background: target.accent }} />
        </div>
      </div>
    </div>
  )
}
