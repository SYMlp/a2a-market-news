'use client'

import { useState } from 'react'

export interface ProfileArgs {
  changes: Record<string, string>
}

export type ProfileCardStatus = 'pending' | 'executing' | 'done'

interface ProfileCardProps {
  args: ProfileArgs
  status: ProfileCardStatus
  accentRgb: string
  onConfirm: (args: ProfileArgs) => void
  onCancel: () => void
}

const NOTIFY_OPTIONS = [
  { value: 'in_app', label: '仅站内' },
  { value: 'callback', label: '仅回调' },
  { value: 'both', label: '两者都要' },
  { value: 'none', label: '不通知' },
] as const

export default function ProfileCard({
  args: initialArgs,
  status,
  accentRgb,
  onConfirm,
  onCancel,
}: ProfileCardProps) {
  const [changes, setChanges] = useState<Record<string, string>>(initialArgs.changes ?? {})
  const editable = status === 'pending'

  const borderColor =
    status === 'done' ? 'border-green-400/60' :
    status === 'executing' ? 'border-amber-400/60' :
    'border-white/20'

  const dotColor =
    status === 'done' ? 'bg-green-400' :
    status === 'executing' ? 'bg-amber-400 animate-pulse' :
    'bg-white/60'

  const update = (key: string, value: string) => {
    setChanges(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div
      className={`register-card rounded-2xl border backdrop-blur-md overflow-hidden text-xs ${borderColor}`}
      style={{
        background: `linear-gradient(135deg, rgba(${accentRgb},0.12), rgba(0,0,0,0.4))`,
        boxShadow: `0 8px 32px rgba(${accentRgb},0.15)`,
      }}
    >
      <div
        className="px-4 py-2.5 flex items-center justify-between border-b border-white/10"
        style={{ background: `rgba(${accentRgb},0.1)` }}
      >
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
          <code className="text-white/70 font-mono text-[11px]">
            GM.updateProfile()
            {status === 'done' && <span className="text-green-400 ml-2 font-sans">✓ 已更新</span>}
            {status === 'executing' && <span className="text-amber-300 ml-2 font-sans">更新中...</span>}
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

      <div className="px-4 py-3.5 space-y-3">
        <FieldRow label="开发者名称">
          {editable ? (
            <input
              value={changes.developerName ?? ''}
              onChange={e => update('developerName', e.target.value)}
              className="flex-1 px-2.5 py-1.5 bg-black/30 border border-white/15 rounded-lg text-white text-sm
                placeholder:text-white/30 focus:border-white/40 focus:ring-1 focus:ring-white/10 focus:outline-none transition-all"
              placeholder="开发者/工作室名称"
            />
          ) : (
            <span className="text-white text-sm">{changes.developerName ?? '-'}</span>
          )}
        </FieldRow>

        <FieldRow label="回调 URL">
          {editable ? (
            <input
              value={changes.callbackUrl ?? ''}
              onChange={e => update('callbackUrl', e.target.value)}
              className="flex-1 px-2.5 py-1.5 bg-black/30 border border-white/15 rounded-lg text-white text-sm
                placeholder:text-white/30 focus:border-white/40 focus:ring-1 focus:ring-white/10 focus:outline-none transition-all"
              placeholder="https://..."
            />
          ) : (
            <span className="text-white text-sm">{changes.callbackUrl ?? '-'}</span>
          )}
        </FieldRow>

        <FieldRow label="通知偏好">
          {editable ? (
            <div className="flex gap-2 flex-wrap">
              {NOTIFY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update('notifyPreference', opt.value)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                    (changes.notifyPreference ?? 'in_app') === opt.value
                      ? 'bg-white/20 border-white/40 text-white border shadow-sm'
                      : 'bg-black/20 border border-white/10 text-white/50 hover:border-white/30'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-white text-sm">
              {NOTIFY_OPTIONS.find(o => o.value === (changes.notifyPreference ?? 'in_app'))?.label ?? changes.notifyPreference ?? '-'}
            </span>
          )}
        </FieldRow>
      </div>

      {status === 'pending' && (
        <div className="px-4 py-3 border-t border-white/10">
          <button
            onClick={() => onConfirm({ changes })}
            disabled={Object.keys(changes).length === 0}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all
              disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110"
            style={{
              background: `linear-gradient(135deg, rgba(${accentRgb},0.8), rgba(${accentRgb},0.5))`,
              boxShadow: `0 4px 12px rgba(${accentRgb},0.3)`,
            }}
          >
            确认修改
          </button>
          <p className="text-center text-[10px] text-white/30 mt-2">
            可修改上方字段 · 确认后 GM 将更新开发者资料
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
