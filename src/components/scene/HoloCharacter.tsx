'use client'

interface HoloCharacterProps {
  emoji: string
  name: string
  accentRgb: string
  state?: 'idle' | 'walking' | 'thinking' | 'materialize'
  side: 'npc' | 'pa'
}

export default function HoloCharacter({
  emoji,
  name,
  accentRgb,
  state = 'idle',
  side,
}: HoloCharacterProps) {
  const stateClass =
    state === 'walking' ? 'holo-char--walking' :
    state === 'thinking' ? 'holo-char--thinking' :
    state === 'materialize' ? 'holo-char--materialize' : ''

  return (
    <div
      className={`holo-char ${stateClass}`}
      style={{ '--sc-accent-rgb': accentRgb } as React.CSSProperties}
    >
      <div className={`holo-char__frame ${state === 'idle' ? 'holo-char__float' : ''}`}>
        <div className="holo-char__scan" />
        <span className="holo-char__emoji">{emoji}</span>
      </div>
      <span className="holo-char__name">{name}</span>
      {side === 'pa' && state === 'idle' && (
        <span className="holo-char__status">ONLINE</span>
      )}
    </div>
  )
}
