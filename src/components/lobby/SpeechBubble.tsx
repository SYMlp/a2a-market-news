'use client'

import { useState, useEffect, useRef } from 'react'

interface SpeechBubbleProps {
  text: string
  side: 'left' | 'right'
  accent?: string
  onComplete?: () => void
  instant?: boolean
}

const CHAR_SPEED = 28

export default function SpeechBubble({ text, side, accent, onComplete, instant }: SpeechBubbleProps) {
  const [displayed, setDisplayed] = useState(instant ? text : '')
  const [done, setDone] = useState(!!instant)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    if (instant) {
      setDisplayed(text)
      setDone(true)
      return
    }
    setDisplayed('')
    setDone(false)
    let i = 0
    const iv = setInterval(() => {
      i++
      if (i >= text.length) {
        setDisplayed(text)
        setDone(true)
        clearInterval(iv)
        onCompleteRef.current?.()
      } else {
        setDisplayed(text.slice(0, i))
      }
    }, CHAR_SPEED)
    return () => clearInterval(iv)
  }, [text, instant])

  const accentColor = accent || 'var(--lobby-accent)'

  return (
    <div
      className={`sb sb--${side} ${done ? 'sb--done' : 'sb--typing'}`}
      style={{ '--sb-accent': accentColor } as React.CSSProperties}
    >
      <div className="sb__body">
        <span className="sb__text">{displayed}</span>
        {!done && <span className="sb__cursor">|</span>}
      </div>
      <div className={`sb__tail sb__tail--${side}`} />
    </div>
  )
}
