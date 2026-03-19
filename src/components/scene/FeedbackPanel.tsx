'use client'

import { useState } from 'react'

interface FeedbackItem {
  id: string
  agentName: string
  summary: string
  overallRating: number
  createdAt: string
  appId?: string
}

interface FeedbackPanelProps {
  feedbacks: FeedbackItem[]
  feedbackCount: number
  accentRgb: string
  open: boolean
  onClose: () => void
}

function ratingStars(rating: number): string {
  return '★'.repeat(Math.max(0, Math.min(5, rating))) + '☆'.repeat(Math.max(0, 5 - rating))
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  return `${days} 天前`
}

export default function FeedbackPanel({
  feedbacks,
  feedbackCount,
  accentRgb,
  open,
  onClose,
}: FeedbackPanelProps) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed top-0 left-0 h-full z-50 transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ width: 'min(360px, 85vw)' }}
      >
        <div
          className="h-full flex flex-col border-r border-white/10 overflow-hidden"
          style={{
            background: `linear-gradient(180deg, rgba(${accentRgb},0.15) 0%, rgba(0,0,0,0.92) 30%)`,
            backdropFilter: 'blur(24px)',
          }}
        >
          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-base">💬</span>
              <span className="text-white font-semibold text-sm">用户建议</span>
              {feedbackCount > 0 && (
                <span
                  className="px-1.5 py-0.5 text-[10px] font-bold rounded-full text-white"
                  style={{ background: `rgba(${accentRgb},0.7)` }}
                >
                  {feedbackCount}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white/80 text-sm transition-colors w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10"
            >
              ✕
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {feedbacks.length === 0 ? (
              <div className="text-center text-white/30 text-xs py-12">
                暂无用户建议，等有访客体验后就会出现啦
              </div>
            ) : (
              feedbacks.map((fb) => (
                <div
                  key={fb.id}
                  className="p-3 rounded-xl border border-white/8 hover:border-white/15 transition-colors"
                  style={{ background: 'rgba(255,255,255,0.04)' }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-white/80 text-xs font-medium">
                      {fb.agentName}
                    </span>
                    <span className="text-white/25 text-[10px]">
                      {timeAgo(fb.createdAt)}
                    </span>
                  </div>
                  <p className="text-white/60 text-xs leading-relaxed mb-1.5">
                    {fb.summary}
                  </p>
                  <div
                    className="text-[11px] tracking-wider"
                    style={{ color: `rgba(${accentRgb},0.8)` }}
                  >
                    {ratingStars(fb.overallRating)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * Small badge that sits on the left edge of the screen.
 * Only renders when feedbackCount > 0.
 */
export function FeedbackBadge({
  count,
  accentRgb,
  onClick,
}: {
  count: number
  accentRgb: string
  onClick: () => void
}) {
  if (count <= 0) return null

  return (
    <button
      onClick={onClick}
      className="feedback-badge fixed left-3 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white border border-white/15 hover:border-white/30 transition-all hover:scale-105 active:scale-95"
      style={{
        top: '50%',
        transform: 'translateY(-50%)',
        background: `linear-gradient(135deg, rgba(${accentRgb},0.5), rgba(${accentRgb},0.25))`,
        boxShadow: `0 4px 16px rgba(${accentRgb},0.3)`,
        animation: 'feedbackBadgePulse 3s ease-in-out infinite',
      }}
    >
      <span>💬</span>
      <span>{count} 条新建议</span>
    </button>
  )
}
