'use client'

import { useId } from 'react'

/**
 * Sprite sheet configuration for a single animation.
 *
 * The sheet is a horizontal strip: N frames side-by-side, each frameWidth × frameHeight.
 * Total image dimensions = (frameWidth × frameCount) × frameHeight.
 */
export interface SpriteSheet {
  src: string
  frameCount: number
  frameWidth: number
  frameHeight: number
}

export interface SpriteAnimationProps {
  /** Sprite sheet to animate */
  sheet: SpriteSheet
  /** Display width in px (default: frameWidth) */
  width?: number
  /** Display height in px (default: scaled proportionally to width) */
  height?: number
  /** Seconds for one full cycle (default: 0.5) */
  speed?: number
  /** Facing direction — 'left' flips horizontally (default: 'right') */
  direction?: 'left' | 'right'
  /** Whether to play the animation (default: true) */
  playing?: boolean
  /** Extra CSS className */
  className?: string
}

export default function SpriteAnimation({
  sheet,
  width,
  height,
  speed = 0.5,
  direction = 'right',
  playing = true,
  className,
}: SpriteAnimationProps) {
  const uid = useId().replace(/:/g, '')

  const displayW = width ?? sheet.frameWidth
  const scale = displayW / sheet.frameWidth
  const displayH = height ?? Math.round(sheet.frameHeight * scale)
  const totalBgW = displayW * sheet.frameCount

  const animName = `sprAnim_${uid}`

  return (
    <>
      <style>{`
        @keyframes ${animName} {
          from { background-position: 0 0; }
          to { background-position: -${totalBgW}px 0; }
        }
      `}</style>
      <div
        className={className}
        style={{
          width: displayW,
          height: displayH,
          backgroundImage: `url('${sheet.src}')`,
          backgroundSize: `${totalBgW}px ${displayH}px`,
          backgroundRepeat: 'no-repeat',
          imageRendering: 'pixelated',
          transform: direction === 'left' ? 'scaleX(-1)' : undefined,
          animation: playing
            ? `${animName} ${speed}s steps(${sheet.frameCount}) infinite`
            : undefined,
          backgroundPosition: '0 0',
        }}
      />
    </>
  )
}
