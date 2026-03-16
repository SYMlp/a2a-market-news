'use client'

import SpriteCharacter from './SpriteCharacter'

interface CharacterStageProps {
  npcSprite?: string
  npcName: string
  paName: string
  accentRgb: string
  paAccentRgb?: string
  npcBubble?: string | null
  paBubble?: string | null
  paState: 'idle' | 'walking' | 'thinking'
}

export default function CharacterStage({
  npcSprite = '/sprites/npc.png',
  npcName,
  paName,
  accentRgb,
  paAccentRgb = '59,130,246',
  npcBubble,
  paBubble,
  paState,
}: CharacterStageProps) {
  return (
    <div className="char-stage">
      {/* NPC (left side, faces right) */}
      <div className="char-stage__npc">
        {npcBubble && (
          <div className="char-stage__bubble char-stage__bubble--npc" key={npcBubble.slice(0, 20)}>
            <div className="char-stage__bubble-body">
              <div className="char-stage__bubble-text">{npcBubble}</div>
            </div>
            <div className="char-stage__bubble-tail" />
          </div>
        )}
        <SpriteCharacter
          src={npcSprite}
          label={npcName}
          state="idle"
          direction="right"
          accentRgb={accentRgb}
        />
      </div>

      {/* PA (right side, faces left) */}
      <div className="char-stage__pa">
        {paState === 'thinking' && (
          <div className="char-stage__thinking">
            <div className="char-stage__thinking-dots"><i /><i /><i /></div>
            <span className="char-stage__thinking-label">THINKING</span>
          </div>
        )}
        {paBubble && paState !== 'thinking' && (
          <div className="char-stage__bubble char-stage__bubble--pa" key={paBubble.slice(0, 20)}>
            <div className="char-stage__bubble-body" style={{ '--sc-accent-rgb': paAccentRgb } as React.CSSProperties}>
              <div className="char-stage__bubble-text">{paBubble}</div>
            </div>
            <div className="char-stage__bubble-tail" style={{ '--sc-accent-rgb': paAccentRgb } as React.CSSProperties} />
          </div>
        )}
        <SpriteCharacter
          src="/sprites/pa.png"
          label={paName}
          state={paState}
          direction="left"
          accentRgb={paAccentRgb}
        />
      </div>
    </div>
  )
}
