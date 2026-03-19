'use client'

interface CardTemplate {
  title: string
  subtitle?: string
}

interface AnimationConfig {
  enter?: string
  idle?: string
}

interface DeckViewProps {
  data: unknown[]
  card?: CardTemplate
  animation?: AnimationConfig
  accentRgb: string
}

function interpolate(template: string, item: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const val = item[key]
    return val != null ? String(val) : match
  })
}

export default function DeckView({
  data,
  card,
  animation,
  accentRgb,
}: DeckViewProps) {
  if (!data || data.length === 0) return null

  const items = data as Record<string, unknown>[]
  const useCascade = animation?.enter === 'cascade'
  const useFloat = animation?.idle === 'float'

  return (
    <div className="deck-view">
      {items.map((item, i) => {
        const title = card?.title ? interpolate(card.title, item) : `Item ${i + 1}`
        const subtitle = card?.subtitle ? interpolate(card.subtitle, item) : null

        return (
          <div
            key={String(item.clientId ?? item.id ?? i)}
            className={`deck-card${useFloat ? ' deck-card--float' : ''}`}
            style={{
              animationDelay: useCascade ? `${i * 120}ms` : '0ms',
              ['--deck-accent-rgb' as string]: accentRgb,
              ['--deck-float-offset' as string]: `${(i % 3) * 0.4}s`,
            }}
          >
            <div className="deck-card__index">{i + 1}</div>
            <div className="deck-card__body">
              <div className="deck-card__title">{title}</div>
              {subtitle && (
                <div className="deck-card__subtitle">{subtitle}</div>
              )}
            </div>
            <div className="deck-card__arrow">→</div>
          </div>
        )
      })}
    </div>
  )
}
