'use client'
import Image from 'next/image'

export type CharacterState = 'idle' | 'walking' | 'thinking' | 'entering_portal' | 'exiting'

interface SpriteCharacterProps {
  src: string
  label?: string
  state?: CharacterState
  direction?: 'left' | 'right' | 'up' | 'down'
  accentRgb?: string
  scale?: number
}

export default function SpriteCharacter({
  src,
  label,
  state = 'idle',
  direction = 'down',
  accentRgb = '0,210,255',
  scale = 2.5,
}: SpriteCharacterProps) {
  const imgTransform =
    direction === 'left' ? 'scaleX(-1)' :
    undefined

  return (
    <div
      className={`spr spr--${state}`}
      style={{
        '--spr-accent-rgb': accentRgb,
        '--spr-scale': scale,
      } as React.CSSProperties}
    >
      {label && (
        <div className="spr__label">{label}</div>
      )}

      <div className="spr__wrap">
        <Image
          src={src}
          alt={label || 'character'}
          width={160}
          height={160}
          unoptimized
          className="spr__img"
          style={{ transform: imgTransform }}
          draggable={false}
        />
        <div className="spr__glow" />
      </div>

      <div className="spr__shadow" />
    </div>
  )
}
