'use client'

import { useState } from 'react'
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
  npcState?: CharacterState
}

const BUBBLE_TRUNCATE = 200

function BubbleText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const needsTruncate = text.length > BUBBLE_TRUNCATE

  if (!needsTruncate || expanded) {
    return (
      <div className="char-stage__bubble-text">
        {text}
        {needsTruncate && (
          <button type="button" className="char-stage__bubble-toggle" onClick={() => setExpanded(false)}>
            收起
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="char-stage__bubble-text">
      {text.slice(0, BUBBLE_TRUNCATE)}...
      <button type="button" className="char-stage__bubble-toggle" onClick={() => setExpanded(true)}>
        展开全部
      </button>
    </div>
  )
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
  npcState = 'idle',
}: CharacterStageProps) {
  return (
    <div className="char-stage">
      {/* NPC side (left) */}
      <div className="char-stage__side char-stage__side--npc">
        <div className="char-stage__avatar">
          {npcState === 'thinking' && (
            <div className="char-stage__thinking">
              <div className="char-stage__thinking-dots"><i /><i /><i /></div>
              <span className="char-stage__thinking-label">思考中</span>
            </div>
          )}
          <SpriteCharacter
            src={npcSprite}
            label={npcName}
            state={npcState}
            direction="down"
            accentRgb={accentRgb}
          />
        </div>
        {npcBubble && npcState !== 'thinking' && (
          <div className="char-stage__bubble char-stage__bubble--npc" key={npcBubble.slice(0, 20)}>
            <div className="char-stage__bubble-body">
              <BubbleText text={npcBubble} />
            </div>
          </div>
        )}
      </div>

      <div className="char-stage__center">
        <div className="char-stage__center-line" />
      </div>

      <div className="char-stage__side char-stage__side--pa">
        <div className="char-stage__avatar">
          {paState === 'thinking' && (
            <div className="char-stage__thinking">
              <div className="char-stage__thinking-dots"><i /><i /><i /></div>
              <span className="char-stage__thinking-label">思考中</span>
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
              <BubbleText text={paBubble} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
