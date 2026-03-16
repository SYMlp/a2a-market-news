'use client'

type CharacterState = 'idle' | 'walking' | 'thinking'

interface SpriteCharacterProps {
  src: string
  label?: string
  state?: CharacterState
  direction?: 'left' | 'right'
  accentRgb?: string
  scale?: number
}

export default function SpriteCharacter({
  src,
  label,
  state = 'idle',
  direction = 'right',
  accentRgb = '0,210,255',
  scale = 2.5,
}: SpriteCharacterProps) {
  return (
    <div
      className={`spr spr--${state}`}
      style={{
        '--spr-accent-rgb': accentRgb,
        '--spr-scale': scale,
      } as React.CSSProperties}
    >
      <div className="spr__wrap">
        <img
          src={src}
          alt={label || 'character'}
          className="spr__img"
          style={{
            transform: direction === 'left' ? 'scaleX(-1)' : undefined,
          }}
          draggable={false}
        />
        <div className="spr__glow" />
      </div>

      <div className="spr__shadow" />

      {label && (
        <div className="spr__label">{label}</div>
      )}
    </div>
  )
}
