'use client'

import { useTranslations } from 'next-intl'
import DeckView from './DeckView'

interface SceneAppDockProps {
  title: string
  accentRgb: string
  data: unknown[]
  card?: { title: string; subtitle?: string }
  animation?: { enter?: string; idle?: string }
  /** Items before UI cap (from session) */
  totalSourceCount: number
  maxSlots: number
}

export default function SceneAppDock({
  title,
  accentRgb,
  data,
  card,
  animation,
  totalSourceCount,
  maxSlots,
}: SceneAppDockProps) {
  const t = useTranslations('agentSpace')
  const capped = totalSourceCount > maxSlots
  const metaText = capped
    ? t('sceneAppDock.metaCapped', { shown: data.length, total: totalSourceCount, max: maxSlots })
    : t('sceneAppDock.metaShort', { count: data.length })

  return (
    <aside
      className="scene-app-dock"
      style={{ '--dock-accent-rgb': accentRgb } as React.CSSProperties}
      aria-label={title}
    >
      <div className="scene-app-dock__chrome">
        <span className="scene-app-dock__corner scene-app-dock__corner--l" />
        <div className="scene-app-dock__head">
          <span className="scene-app-dock__glyph">▣</span>
          <span className="scene-app-dock__title">{title}</span>
          <span className="scene-app-dock__meta">
            {metaText}
          </span>
        </div>
        <span className="scene-app-dock__corner scene-app-dock__corner--r" />
      </div>
      <div className="scene-app-dock__strip">
        <DeckView
          variant="dock"
          data={data}
          card={card}
          animation={animation}
          accentRgb={accentRgb}
        />
      </div>
    </aside>
  )
}
