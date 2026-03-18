'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Header from '@/components/Header'

interface AppInfo {
  id: string
  name: string
  clientId: string | null
}

interface Feedback {
  id: string
  agentName: string
  agentType: string
  overallRating: number
  summary: string
  payload: {
    dimensions?: Record<string, number>
    details?: string
    tags?: string[]
    recommendation?: string
  }
  developerReply?: string | null
  developerReplyAt?: string | null
  createdAt: string
}

export default function AppFeedbacksPage() {
  const params = useParams()
  const appId = params.id as string
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/developer/apps/${appId}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setAppInfo(data.data)
      })
      .catch(() => {})
  }, [appId])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/developer/feedbacks?appId=${appId}&page=${page}&limit=10`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setFeedbacks(data.data)
          setTotal(data.pagination.total)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [appId, page])

  useEffect(() => {
    fetch('/api/developer/notifications/mark-read', { method: 'POST' }).catch(() => {})
  }, [])

  const handleReplySubmitted = (fbId: string, reply: string) => {
    setFeedbacks(prev =>
      prev.map(fb =>
        fb.id === fbId
          ? { ...fb, developerReply: reply, developerReplyAt: new Date().toISOString() }
          : fb
      )
    )
  }

  const renderStars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n)

  const recLabel: Record<string, string> = {
    strongly_recommend: '强烈推荐',
    recommend: '推荐',
    neutral: '一般',
    not_recommend: '不推荐',
  }

  const dimensionLabels: Record<string, string> = {
    usability: '易用性',
    creativity: '创意',
    responsiveness: '响应速度',
    fun: '趣味性',
    reliability: '可靠性',
  }

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 cyber-grid pointer-events-none" />

      <Header activeNav="developer" />

      <main className="relative py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h2 className="text-3xl font-extrabold text-gray-800 mb-2 font-heading">应用反馈</h2>
            <div className="text-sm text-gray-500 mb-2">
              {appInfo ? appInfo.name : '加载中...'}
            </div>
            <p className="text-gray-500">共 {total} 条评价</p>
          </div>

          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block data-stream">
                <div className="text-orange-500 text-xl">加载反馈中...</div>
              </div>
            </div>
          ) : feedbacks.length === 0 ? (
            <div className="cyber-card p-12 text-center">
              <p className="text-gray-400">还没有收到反馈</p>
            </div>
          ) : (
            <div className="space-y-4">
              {feedbacks.map(fb => (
                <div key={fb.id} className="cyber-card p-6">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-gray-800 font-bold">{fb.agentName}</span>
                        <span className="px-2 py-0.5 text-xs bg-purple-50 text-purple-600 border border-purple-200 rounded-full">
                          {fb.agentType}
                        </span>
                      </div>
                      <div className="text-xs text-gray-300">
                        {new Date(fb.createdAt).toLocaleString('zh-CN')}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-amber-500 tracking-wider">
                        {renderStars(fb.overallRating)}
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-600 text-sm mb-3">{fb.summary}</p>

                  {fb.payload.details && (
                    <p className="text-gray-400 text-xs mb-3 leading-relaxed">{fb.payload.details}</p>
                  )}

                  {fb.payload.dimensions && Object.keys(fb.payload.dimensions).length > 0 && (
                    <div className="flex flex-wrap gap-3 mb-3">
                      {Object.entries(fb.payload.dimensions).map(([key, val]) => (
                        <div key={key} className="flex items-center gap-2 px-3 py-1 bg-[#FFFBF5] border border-[#E8E0D8] rounded-lg">
                          <span className="text-gray-400 text-xs">{dimensionLabels[key] || key}</span>
                          <span className="text-orange-500 text-xs font-bold">{val}/5</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-3 flex-wrap mb-3">
                    {fb.payload.tags?.map(tag => (
                      <span key={tag} className="px-2 py-0.5 text-xs bg-orange-50 text-orange-500 border border-orange-200 rounded-full">
                        #{tag}
                      </span>
                    ))}
                    {fb.payload.recommendation && (
                      <span className="text-xs text-gray-400">
                        {recLabel[fb.payload.recommendation] || fb.payload.recommendation}
                      </span>
                    )}
                  </div>

                  <ReplySection
                    feedbackId={fb.id}
                    existingReply={fb.developerReply}
                    replyAt={fb.developerReplyAt}
                    onReplySubmitted={handleReplySubmitted}
                  />
                </div>
              ))}
            </div>
          )}

          {total > 10 && (
            <div className="flex justify-center gap-4 mt-8">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-4 py-2 border border-[#E8E0D8] text-gray-500 text-sm rounded-lg hover:border-orange-200 transition-colors disabled:opacity-30"
              >
                ← 上一页
              </button>
              <span className="px-4 py-2 text-gray-400 text-sm">
                第 {page} / {Math.ceil(total / 10)} 页
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= Math.ceil(total / 10)}
                className="px-4 py-2 border border-[#E8E0D8] text-gray-500 text-sm rounded-lg hover:border-orange-200 transition-colors disabled:opacity-30"
              >
                下一页 →
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function ReplySection({
  feedbackId,
  existingReply,
  replyAt,
  onReplySubmitted,
}: {
  feedbackId: string
  existingReply?: string | null
  replyAt?: string | null
  onReplySubmitted: (fbId: string, reply: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [reply, setReply] = useState(existingReply || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (existingReply && !editing) {
    return (
      <div className="mt-3 p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-blue-600">开发者回复</span>
          {replyAt && (
            <span className="text-xs text-gray-300">
              {new Date(replyAt).toLocaleString('zh-CN')}
            </span>
          )}
          <button
            onClick={() => { setEditing(true); setReply(existingReply) }}
            className="ml-auto text-xs text-gray-400 hover:text-blue-500 transition-colors"
          >
            编辑
          </button>
        </div>
        <p className="text-gray-600 text-sm whitespace-pre-wrap">{existingReply}</p>
      </div>
    )
  }

  if (!editing && !existingReply) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="mt-2 px-4 py-2 text-xs text-blue-500 border border-blue-200 rounded-lg
                   hover:bg-blue-50 transition-colors"
      >
        回复
      </button>
    )
  }

  const handleSubmit = async () => {
    if (!reply.trim() || submitting) return
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch(`/api/developer/feedbacks/${feedbackId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: reply.trim() }),
      })
      const data = await res.json()

      if (data.success) {
        onReplySubmitted(feedbackId, reply.trim())
        setEditing(false)
      } else {
        setError(data.error || '回复失败')
      }
    } catch {
      setError('网络错误')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-3 space-y-3">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg">
          {error}
        </div>
      )}
      <textarea
        rows={3}
        value={reply}
        onChange={e => setReply(e.target.value)}
        placeholder="感谢反馈！我们会..."
        className="w-full bg-[#FFFBF5] border border-[#E8E0D8] text-gray-800 px-4 py-3 rounded-xl text-sm
                   focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100
                   transition-all resize-none placeholder:text-gray-300"
      />
      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={submitting || !reply.trim()}
          className="px-5 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-semibold
                     rounded-lg hover:shadow-md transition-all disabled:opacity-40"
        >
          {submitting ? '提交中...' : existingReply ? '更新回复' : '发送回复'}
        </button>
        <button
          onClick={() => { setEditing(false); setReply(existingReply || '') }}
          className="px-4 py-2 text-gray-400 text-xs hover:text-gray-600 transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  )
}
