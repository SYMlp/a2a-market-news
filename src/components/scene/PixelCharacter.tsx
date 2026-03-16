'use client'

export type CharacterSkin = 'pa' | 'receptionist' | 'editor' | 'techie'
type CharacterState = 'idle' | 'walking' | 'thinking'

interface PixelCharacterProps {
  skin: CharacterSkin
  state?: CharacterState
  direction?: 'left' | 'right'
  label?: string
  scale?: number
}

const SKINS: Record<CharacterSkin, {
  hair: string; skin: string; shirt: string; pants: string; shoes: string
  accessory?: 'goggles' | 'bunny-ears' | 'fedora' | 'glasses'
  accent: string
}> = {
  pa:           { hair: '#2d3a4a', skin: '#f5d0a9', shirt: '#3b82f6', pants: '#1e3a5f', shoes: '#1a1a2e', accessory: 'goggles', accent: '#3b82f6' },
  receptionist: { hair: '#e0f0ff', skin: '#f5d0a9', shirt: '#00d2ff', pants: '#0a4a5f', shoes: '#0a1a2e', accessory: 'bunny-ears', accent: '#00d2ff' },
  editor:       { hair: '#4a3520', skin: '#f5d0a9', shirt: '#ffb020', pants: '#3a2a10', shoes: '#1a1a1a', accessory: 'fedora', accent: '#ffb020' },
  techie:       { hair: '#6b21a8', skin: '#f5d0a9', shirt: '#a855f7', pants: '#3b1a6e', shoes: '#1a1a2e', accessory: 'glasses', accent: '#a855f7' },
}

export default function PixelCharacter({
  skin,
  state = 'idle',
  direction = 'right',
  label,
  scale = 3,
}: PixelCharacterProps) {
  const s = SKINS[skin]
  const px = 4 * scale

  return (
    <div
      className={`pxc pxc--${state}`}
      style={{
        '--pxc-scale': scale,
        '--pxc-px': `${px}px`,
        '--pxc-accent': s.accent,
        transform: direction === 'left' ? 'scaleX(-1)' : undefined,
      } as React.CSSProperties}
    >
      <div className="pxc__body-wrap">
        {/* Accessory layer */}
        {s.accessory === 'bunny-ears' && (
          <div className="pxc__ears">
            <div className="pxc__ear" style={{ background: '#fff', left: `${px * 0.5}px` }} />
            <div className="pxc__ear" style={{ background: '#fff', left: `${px * 2}px` }} />
          </div>
        )}
        {s.accessory === 'fedora' && (
          <div className="pxc__hat" style={{ background: s.hair }} />
        )}

        {/* Head */}
        <div className="pxc__head" style={{ background: s.skin }}>
          <div className="pxc__hair" style={{ background: s.hair }} />
          <div className="pxc__eyes">
            <div className="pxc__eye" />
            <div className="pxc__eye" />
          </div>
          {s.accessory === 'goggles' && <div className="pxc__goggles" />}
          {s.accessory === 'glasses' && <div className="pxc__px-glasses" style={{ borderColor: s.accent }} />}
        </div>

        {/* Torso */}
        <div className="pxc__torso" style={{ background: s.shirt }}>
          <div className="pxc__belt" />
        </div>

        {/* Arms */}
        <div className="pxc__arm pxc__arm--l" style={{ background: s.shirt }} />
        <div className="pxc__arm pxc__arm--r" style={{ background: s.shirt }} />

        {/* Legs */}
        <div className="pxc__legs">
          <div className="pxc__leg pxc__leg--l" style={{ background: s.pants }}>
            <div className="pxc__shoe" style={{ background: s.shoes }} />
          </div>
          <div className="pxc__leg pxc__leg--r" style={{ background: s.pants }}>
            <div className="pxc__shoe" style={{ background: s.shoes }} />
          </div>
        </div>
      </div>

      {/* Shadow on ground */}
      <div className="pxc__shadow" />

      {/* Name label */}
      {label && (
        <div className="pxc__label" style={{ transform: direction === 'left' ? 'scaleX(-1)' : undefined }}>
          {label}
        </div>
      )}
    </div>
  )
}
