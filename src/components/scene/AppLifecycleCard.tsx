'use client'

import { useState } from 'react'

export interface AppLifecycleArgs {
  appId: string
  newStatus: 'active' | 'inactive' | 'archived'
}

export type AppLifecycleCardStatus = 'pending' | 'executing' | 'done'

interface AppLifecycleCardProps {
  args: AppLifecycleArgs
  status: AppLifecycleCardStatus
  accentRgb: string
  onConfirm: (args: AppLifecycleArgs) => void
  onCancel: () => void
}

const STATUS_LABELS: Record<string, string> = {
  active: '恢复活跃',
  inactive: '暂停',
  archived: '归档',
}

export default function AppLifecycleCard({
  args,
  status,
  accentRgb,
  onConfirm,
  onCancel,
}: AppLifecycleCardProps) {
  const editable = status === 'pending'
  const statusLabel = STATUS_LABELS[args.newStatus] ?? args.newStatus

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
      <div
        className="px-4 py-2.5 flex items-center justify-between border-b border-white/10"
        style={{ background: `rgba(${accentRgb},0.1)` }}
      >
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
          <code className="text-white/70 font-mono text-[11px]">
            GM.changeAppStatus()
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
        <div className="flex items-start gap-3">
          <span className="text-white/40 text-[11px] w-16 shrink-0 pt-1.5">操作</span>
          <span className="text-white text-sm">{statusLabel}</span>
        </div>
      </div>

      {status === 'pending' && (
        <div className="px-4 py-3 border-t border-white/10">
          <button
            onClick={() => onConfirm(args)}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all
              hover:brightness-110"
            style={{
              background: `linear-gradient(135deg, rgba(${accentRgb},0.8), rgba(${accentRgb},0.5))`,
              boxShadow: `0 4px 12px rgba(${accentRgb},0.3)`,
            }}
          >
            确认{statusLabel}
          </button>
          <p className="text-center text-[10px] text-white/30 mt-2">
            确认后 GM 将更新应用状态
          </p>
        </div>
      )}
    </div>
  )
}
