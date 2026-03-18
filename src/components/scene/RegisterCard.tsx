'use client'

import { useState } from 'react'

export interface RegisterAppArgs {
  name: string
  description: string
  circleType: string
}

export type RegisterCardStatus = 'pending' | 'executing' | 'done'

interface RegisterCardProps {
  args: RegisterAppArgs
  status: RegisterCardStatus
  accentRgb: string
  onConfirm: (args: RegisterAppArgs) => void
  onCancel: () => void
}

const CIRCLES = [
  { value: 'internet', emoji: '🌐', label: '互联网圈' },
  { value: 'game', emoji: '🎮', label: '游戏圈' },
  { value: 'wilderness', emoji: '🚀', label: '无人区圈' },
] as const

export default function RegisterCard({
  args: initialArgs,
  status,
  accentRgb,
  onConfirm,
  onCancel,
}: RegisterCardProps) {
  const [args, setArgs] = useState<RegisterAppArgs>(initialArgs)
  const editable = status === 'pending'
  const circle = CIRCLES.find(c => c.value === args.circleType) || CIRCLES[0]

  const borderColor =
    status === 'done' ? 'border-green-400/60' :
    status === 'executing' ? 'border-amber-400/60' :
    'border-white/20'

  const dotColor =
    status === 'done' ? 'bg-green-400' :
    status === 'executing' ? 'bg-amber-400 animate-pulse' :
    'bg-white/60'

  return (
    <div
      className={`register-card rounded-2xl border backdrop-blur-md overflow-hidden text-xs ${borderColor}`}
      style={{
        background: `linear-gradient(135deg, rgba(${accentRgb},0.12), rgba(0,0,0,0.4))`,
        boxShadow: `0 8px 32px rgba(${accentRgb},0.15)`,
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-2.5 flex items-center justify-between border-b border-white/10"
        style={{ background: `rgba(${accentRgb},0.1)` }}
      >
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
          <code className="text-white/70 font-mono text-[11px]">
            GM.registerApp()
            {status === 'done' && <span className="text-green-400 ml-2 font-sans">✓ 已录入</span>}
            {status === 'executing' && <span className="text-amber-300 ml-2 font-sans">录入中...</span>}
          </code>
        </div>
        {editable && (
          <button
            onClick={onCancel}
            className="text-white/40 hover:text-white/80 text-sm transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Fields */}
      <div className="px-4 py-3.5 space-y-3">
        <FieldRow label="应用名称">
          {editable ? (
            <input
              value={args.name}
              onChange={e => setArgs(prev => ({ ...prev, name: e.target.value }))}
              className="flex-1 px-2.5 py-1.5 bg-black/30 border border-white/15 rounded-lg text-white text-sm
                placeholder:text-white/30 focus:border-white/40 focus:ring-1 focus:ring-white/10 focus:outline-none transition-all"
              placeholder="给你的应用取个名字"
            />
          ) : (
            <span className="text-white text-sm">{args.name}</span>
          )}
        </FieldRow>

        <FieldRow label="简介">
          {editable ? (
            <input
              value={args.description}
              onChange={e => setArgs(prev => ({ ...prev, description: e.target.value }))}
              className="flex-1 px-2.5 py-1.5 bg-black/30 border border-white/15 rounded-lg text-white text-sm
                placeholder:text-white/30 focus:border-white/40 focus:ring-1 focus:ring-white/10 focus:outline-none transition-all"
              placeholder="一句话描述它是做什么的"
            />
          ) : (
            <span className="text-white text-sm">{args.description}</span>
          )}
        </FieldRow>

        <FieldRow label="圈子">
          {editable ? (
            <div className="flex gap-2 flex-wrap">
              {CIRCLES.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setArgs(prev => ({ ...prev, circleType: c.value }))}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    args.circleType === c.value
                      ? 'bg-white/20 border-white/40 text-white border shadow-sm'
                      : 'bg-black/20 border border-white/10 text-white/50 hover:border-white/30'
                  }`}
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-white text-sm">{circle.emoji} {circle.label}</span>
          )}
        </FieldRow>
      </div>

      {/* Confirm button */}
      {status === 'pending' && (
        <div className="px-4 py-3 border-t border-white/10">
          <button
            onClick={() => onConfirm(args)}
            disabled={!args.name.trim() || !args.description.trim()}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all
              disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110"
            style={{
              background: `linear-gradient(135deg, rgba(${accentRgb},0.8), rgba(${accentRgb},0.5))`,
              boxShadow: `0 4px 12px rgba(${accentRgb},0.3)`,
            }}
          >
            确认注册
          </button>
          <p className="text-center text-[10px] text-white/30 mt-2">
            可修改上方字段 · 确认后 GM 将录入系统
          </p>
        </div>
      )}
    </div>
  )
}

function FieldRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-white/40 text-[11px] w-16 shrink-0 pt-1.5">{label}</span>
      {children}
    </div>
  )
}
