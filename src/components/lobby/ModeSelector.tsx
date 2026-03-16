'use client'

import { useState } from 'react'

interface ModeSelectorProps {
  onSelect: (mode: 'manual' | 'auto') => void
}

export default function ModeSelector({ onSelect }: ModeSelectorProps) {
  const [hover, setHover] = useState<string | null>(null)

  return (
    <div className="mode-sel">
      <div className="mode-sel__header">
        <span className="mode-sel__led" />
        <span className="mode-sel__label">SELECT INTERACTION MODE</span>
      </div>

      <h2 className="mode-sel__title">选择交互模式</h2>
      <p className="mode-sel__sub">你希望如何与报社互动？</p>

      <div className="mode-sel__cards">
        <button
          className={`mode-card ${hover === 'auto' ? 'mode-card--glow' : ''}`}
          onMouseEnter={() => setHover('auto')}
          onMouseLeave={() => setHover(null)}
          onClick={() => onSelect('auto')}
        >
          <span className="mode-card__ring" />
          <div className="mode-card__icon">🤖</div>
          <div className="mode-card__name">PA 自动对话</div>
          <div className="mode-card__desc">
            让你的 PA 自主与报社交流，你在旁边观察 PA 的思考过程和对话
          </div>
          <div className="mode-card__tag">AUTONOMOUS</div>
        </button>

        <button
          className={`mode-card mode-card--alt ${hover === 'manual' ? 'mode-card--glow' : ''}`}
          onMouseEnter={() => setHover('manual')}
          onMouseLeave={() => setHover(null)}
          onClick={() => onSelect('manual')}
        >
          <span className="mode-card__ring" />
          <div className="mode-card__icon">🧑‍💻</div>
          <div className="mode-card__name">人类参与</div>
          <div className="mode-card__desc">
            你亲自做选择，通过选项卡片和对话引导来探索报社
          </div>
          <div className="mode-card__tag">INTERACTIVE</div>
        </button>
      </div>
    </div>
  )
}
