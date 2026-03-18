'use client'

import { useState, useEffect, useCallback } from 'react'
import type { TransitionAnimation } from '@/lib/scene-visuals/types'

interface SceneTransitionEngineProps {
  active: boolean
  type: TransitionAnimation
  from: string
  to: string
  toIcon?: string
  toLabel?: string
  accentRgb?: string
  onComplete: () => void
}

const DURATIONS: Record<TransitionAnimation, number> = {
  fade: 1200,
  slide: 1400,
  door: 2000,
  portal: 2200,
}

export default function SceneTransitionEngine({
  active,
  type,
  from,
  to,
  toIcon = '🚪',
  toLabel,
  accentRgb = '0,210,255',
  onComplete,
}: SceneTransitionEngineProps) {
  const [phase, setPhase] = useState<'idle' | 'out' | 'switch' | 'in'>('idle')

  const run = useCallback(() => {
    if (!active) return
    setPhase('out')

    const dur = DURATIONS[type]
    const outMs = dur * 0.4
    const switchMs = dur * 0.2
    const inMs = dur * 0.4

    const t1 = setTimeout(() => setPhase('switch'), outMs)
    const t2 = setTimeout(() => setPhase('in'), outMs + switchMs)
    const t3 = setTimeout(() => {
      setPhase('idle')
      onComplete()
    }, outMs + switchMs + inMs)

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [active, type, onComplete])

  useEffect(() => {
    return run()
  }, [run])

  if (!active || phase === 'idle') return null

  const style = { '--sc-accent-rgb': accentRgb } as React.CSSProperties

  return (
    <div className={`sc-tr sc-tr--${type} sc-tr--${phase}`} style={style} data-from={from} data-to={to}>
      {type === 'fade' && <FadeOverlay phase={phase} />}
      {type === 'slide' && <SlideOverlay phase={phase} from={from} to={to} />}
      {type === 'door' && <DoorOverlay phase={phase} toIcon={toIcon} toLabel={toLabel || to} />}
      {type === 'portal' && <PortalOverlay phase={phase} toIcon={toIcon} toLabel={toLabel || to} />}
    </div>
  )
}

function FadeOverlay({ phase }: { phase: string }) {
  return (
    <div className={`sc-tr-fade sc-tr-fade--${phase}`}>
      <div className="sc-tr-fade__curtain" />
    </div>
  )
}

function SlideOverlay({ phase, from, to }: { phase: string; from: string; to: string }) {
  return (
    <div className={`sc-tr-slide sc-tr-slide--${phase}`}>
      <div className="sc-tr-slide__panel sc-tr-slide__panel--old" data-scene={from} />
      <div className="sc-tr-slide__panel sc-tr-slide__panel--new" data-scene={to} />
    </div>
  )
}

function DoorOverlay({ phase, toIcon, toLabel }: { phase: string; toIcon: string; toLabel: string }) {
  return (
    <div className={`sc-tr-door sc-tr-door--${phase}`}>
      <div className="sc-tr-door__left" />
      <div className="sc-tr-door__right" />
      <div className="sc-tr-door__center">
        <div className="sc-tr-door__icon">{toIcon}</div>
        <div className="sc-tr-door__label">{toLabel}</div>
      </div>
    </div>
  )
}

function PortalOverlay({ phase, toIcon, toLabel }: { phase: string; toIcon: string; toLabel: string }) {
  return (
    <div className={`sc-tr-portal sc-tr-portal--${phase}`}>
      <div className="sc-tr-portal__vortex">
        <div className="sc-tr-portal__ring sc-tr-portal__ring--1" />
        <div className="sc-tr-portal__ring sc-tr-portal__ring--2" />
        <div className="sc-tr-portal__ring sc-tr-portal__ring--3" />
      </div>
      <div className="sc-tr-portal__center">
        <div className="sc-tr-portal__icon">{toIcon}</div>
        <div className="sc-tr-portal__label">{toLabel}</div>
      </div>
    </div>
  )
}
