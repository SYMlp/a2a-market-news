'use client'

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
  const capped = totalSourceCount > maxSlots

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
            {capped
              ? `展示 ${data.length} / ${totalSourceCount}（上限 ${maxSlots}）`
              : `${data.length} 项`}
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
