'use client'

import { useState } from 'react'

interface MistOverlayProps {
  onSelect: (mode: 'manual' | 'auto') => void
}

export default function MistOverlay({ onSelect }: MistOverlayProps) {
  const [exiting, setExiting] = useState(false)

  const handleSelect = (mode: 'manual' | 'auto') => {
    if (exiting) return
    setExiting(true)
    setTimeout(() => onSelect(mode), 500)
  }

  return (
    <div className={`mist-overlay ${exiting ? 'mist-overlay--exit' : ''}`}>
      <div className="mist-overlay__fog" />

      <div className="mist-overlay__content">
        <h2 className="mist-overlay__title">选择交互模式</h2>
        <p className="mist-overlay__sub">你希望如何与报社互动？</p>

        <div className="mist-overlay__cards">
          <button
            className="mist-overlay__card"
            onClick={() => handleSelect('auto')}
          >
            <div className="mist-overlay__card-icon">🤖</div>
            <div className="mist-overlay__card-name">PA 自动对话</div>
            <div className="mist-overlay__card-desc">
              让你的 PA 自主与报社交流，你在旁边观察
            </div>
            <div className="mist-overlay__card-tag">AUTONOMOUS</div>
          </button>

          <button
            className="mist-overlay__card"
            onClick={() => handleSelect('manual')}
          >
            <div className="mist-overlay__card-icon">🧑‍💻</div>
            <div className="mist-overlay__card-name">人类操控</div>
            <div className="mist-overlay__card-desc">
              你亲自做选择，通过选项和对话引导来探索
            </div>
            <div className="mist-overlay__card-tag">INTERACTIVE</div>
          </button>
        </div>
      </div>
    </div>
  )
}
