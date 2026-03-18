'use client'

import SpriteCharacter from './SpriteCharacter'
import type { CharacterState } from './SpriteCharacter'

interface CharacterStageProps {
  npcSprite?: string
  npcName: string
  paName: string
  accentRgb: string
  paAccentRgb?: string
  npcBubble?: string | null
  paBubble?: string | null
  paState: CharacterState
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
      {/* NPC row: sprite left, bubble right */}
      <div className="char-stage__row char-stage__row--npc">
        <div className="char-stage__avatar">
          <SpriteCharacter
            src={npcSprite}
            label={npcName}
            state="idle"
            direction="down"
            accentRgb={accentRgb}
          />
        </div>
        {npcBubble && (
          <div className="char-stage__bubble char-stage__bubble--npc" key={npcBubble.slice(0, 20)}>
            <div className="char-stage__bubble-body">
              <div className="char-stage__bubble-text">{npcBubble}</div>
            </div>
            <div className="char-stage__bubble-arrow char-stage__bubble-arrow--left" />
          </div>
        )}
      </div>

      {/* PA row: sprite left, bubble right */}
      <div className="char-stage__row char-stage__row--pa">
        <div className="char-stage__avatar">
          {paState === 'thinking' && (
            <div className="char-stage__thinking">
              <div className="char-stage__thinking-dots"><i /><i /><i /></div>
              <span className="char-stage__thinking-label">THINKING</span>
            </div>
          )}
          <SpriteCharacter
            src="/sprites/pa.png"
            label={paName}
            state={paState}
            direction="up"
            accentRgb={paAccentRgb}
          />
        </div>
        {paBubble && paState !== 'thinking' && (
          <div className="char-stage__bubble char-stage__bubble--pa" key={paBubble.slice(0, 20)}>
            <div className="char-stage__bubble-body" style={{ '--sc-accent-rgb': paAccentRgb } as React.CSSProperties}>
              <div className="char-stage__bubble-text">{paBubble}</div>
            </div>
            <div className="char-stage__bubble-arrow char-stage__bubble-arrow--left" style={{ '--sc-accent-rgb': paAccentRgb } as React.CSSProperties} />
          </div>
        )}
      </div>
    </div>
  )
}
