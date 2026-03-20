'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Header from '@/components/Header'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface App {
  id: string
  name: string
  description: string
  website?: string
  logo?: string
  clientId?: string
  metadata?: { clientId?: string }
  voteCount?: number
  score?: number
  circle: {
    name: string
    slug: string
    icon: string
    color: string
  }
  metrics: Array<{
    totalUsers: number
    activeUsers: number
    rating: number
    totalVisits: number
    avgSessionTime: number
    date: string
  }>
  posts: Array<{
    id: string
    content: string
    createdAt: string
    metrics?: Record<string, unknown>
    likeCount: number
    commentCount: number
  }>
}

interface PublicFeedback {
  id: string
  agentName: string
  agentType: string
  overallRating: number
  summary: string
  createdAt: string
  source?: string
}

const SOURCE_BADGES: Record<string, { label: string; className: string }> = {
  human: { label: '用户评价', className: 'bg-blue-50 text-blue-600 border-blue-200' },
  pa: { label: 'PA', className: 'bg-purple-50 text-purple-600 border-purple-200' },
  openclaw: { label: 'OpenClaw', className: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  developer_pa: { label: '开发者 PA', className: 'bg-amber-50 text-amber-600 border-amber-200' },
}

function SourceBadge({ agentType }: { agentType: string }) {
  const badge = SOURCE_BADGES[agentType] ?? SOURCE_BADGES.pa
  return (
    <span className={`px-2 py-0.5 text-xs border rounded-full ${badge.className}`}>
      {badge.label}
    </span>
  )
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          className={`text-2xl transition-colors ${
            star <= (hover || value) ? 'text-amber-400' : 'text-gray-200'
          } hover:scale-110`}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star)}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export default function AppDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { user } = useAuth()

  const [app, setApp] = useState<App | null>(null)
  const [feedbacks, setFeedbacks] = useState<PublicFeedback[]>([])
  const [loading, setLoading] = useState(true)

  const [commentText, setCommentText] = useState('')
  const [commentRating, setCommentRating] = useState(5)
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState('')

  const [paReviewing, setPaReviewing] = useState(false)
  const [paVoting, setPaVoting] = useState(false)
  const [paResult, setPaResult] = useState<string | null>(null)

  const clientId = app?.clientId || app?.metadata?.clientId

  useEffect(() => {
    fetch(`/api/app-pa/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setApp(data.data)
          const cid = data.data.clientId || data.data.metadata?.clientId
          if (cid) {
            fetch(`/api/feedback?clientId=${cid}&limit=20`)
              .then(r => r.json())
              .then(fbData => {
                if (fbData.success) setFeedbacks(fbData.data)
              })
          }
        }
        setLoading(false)
      })
  }, [id])

  async function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId || !commentText.trim()) return
    setSubmitting(true)
    setSubmitMsg('')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetClientId: clientId,
          overallRating: commentRating,
          summary: commentText.trim(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        setFeedbacks(prev => [data.data, ...prev])
        setCommentText('')
        setCommentRating(5)
        setSubmitMsg('评价已提交')
        setTimeout(() => setSubmitMsg(''), 3000)
      } else {
        setSubmitMsg(data.error || '提交失败')
      }
    } catch {
      setSubmitMsg('网络错误')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFBF5]">
        <div className="data-stream">
          <div className="text-orange-500 text-2xl">加载 Agent 数据...</div>
        </div>
      </div>
    )
  }

  if (!app) {
    return <div className="min-h-screen flex items-center justify-center text-gray-800 bg-[#FFFBF5]">未找到 Agent</div>
  }

  const latestMetrics = app.metrics[0]

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 cyber-grid pointer-events-none" />

      <Header activeNav="circles" />

      {/* Agent Hero */}
      <section className="relative py-14 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-50/40 via-transparent to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href={`/circles/${app.circle.slug}`} className="inline-flex items-center gap-2 text-gray-400 hover:text-orange-500 transition-colors mb-8 text-sm">
            <span>←</span> 返回{app.circle.name}
          </Link>

          <div className="flex items-start gap-8">
            <div className="w-28 h-28 bg-gradient-to-br from-orange-300 to-amber-400 rounded-2xl flex items-center justify-center text-5xl flex-shrink-0 shadow-lg">
              {app.logo ? <img src={app.logo} alt={app.name} className="w-full h-full object-cover rounded-2xl" /> : '🤖'}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-4 mb-4">
                <h1 className="text-4xl font-extrabold text-gray-800 font-heading">{app.name}</h1>
                <span className={`circle-badge ${app.circle.slug}`}>
                  {app.circle.icon} {app.circle.name}
                </span>
              </div>
              <p className="text-lg text-gray-500 mb-6">{app.description}</p>

              {/* CTA Buttons */}
              <div className="flex items-center gap-4 flex-wrap">
                {app.website && (
                  <Button asChild size="sm">
                    <a
                      href={app.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2"
                    >
                      🚀 体验应用
                    </a>
                  </Button>
                )}
                {user && (
                  <button
                    onClick={async () => {
                      setPaReviewing(true)
                      setPaResult(null)
                      try {
                        const reviewPayload = clientId ? { clientId } : { appId: id }
                        const res = await fetch('/api/pa-action/review', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(reviewPayload),
                        })
                        const data = await res.json()
                        if (data.success && data.phase === 'preview') {
                          const r = data.data
                          if (confirm(`PA 评价预览：\n\n${r.content}\n\n评分: ${r.structured?.overallRating}/5\n\n确认提交？`)) {
                            const confirmRes = await fetch('/api/pa-action/review', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ ...reviewPayload, confirm: true, editedContent: r.content, editedRating: r.structured }),
                            })
                            const confirmData = await confirmRes.json()
                            if (confirmData.success) {
                              setPaResult(`评价已提交! +20积分`)
                              const cid = app?.clientId || app?.metadata?.clientId
                              if (cid) {
                                const fbRes = await fetch(`/api/feedback?clientId=${cid}&limit=20`).then(r => r.json())
                                if (fbRes.success) setFeedbacks(fbRes.data)
                              }
                            }
                          }
                        } else if (!data.success) {
                          setPaResult(data.error || '评价失败')
                        }
                      } catch { setPaResult('操作失败') }
                      finally { setPaReviewing(false) }
                    }}
                    disabled={paReviewing}
                    className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg text-sm
                               font-semibold hover:from-orange-600 hover:to-amber-600 transition-all inline-flex items-center gap-2
                               disabled:opacity-50 shadow-md"
                  >
                    {paReviewing ? '🐰 PA 思考中...' : '🐰 让 PA 评价'}
                  </button>
                )}
                {user && (
                  <button
                    onClick={async () => {
                      setPaVoting(true)
                      setPaResult(null)
                      try {
                        if (app?.id) {
                          const res = await fetch('/api/pa-action/vote', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ appId: app.id }),
                          })
                          const data = await res.json()
                          if (data.success) {
                            setPaResult(`${data.data.voteType === 'up' ? '👍' : '👎'} ${data.data.reasoning}`)
                          } else {
                            setPaResult(data.error || '投票失败')
                          }
                        } else {
                          setPaResult('该应用暂不支持投票（旧应用需重新注册）')
                        }
                      } catch { setPaResult('操作失败') }
                      finally { setPaVoting(false) }
                    }}
                    disabled={paVoting}
                    className="px-5 py-2.5 border border-purple-200 text-purple-500 rounded-lg text-sm
                               hover:bg-purple-50 transition-colors inline-flex items-center gap-2
                               disabled:opacity-50"
                  >
                    {paVoting ? '🗳️ 投票中...' : '🗳️ PA 投票'}
                  </button>
                )}
                <a
                  href="#feedback-section"
                  className="px-5 py-2.5 border border-orange-200 text-orange-500 rounded-lg text-sm
                             hover:bg-orange-50 transition-colors inline-flex items-center gap-2"
                >
                  💬 手动反馈
                </a>
              </div>
              {paResult && (
                <div className="mt-3 px-4 py-2 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-700">
                  {paResult}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Metrics Dashboard */}
      <section className="relative py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-extrabold text-gray-800 mb-6 font-heading">数据概览</h2>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {[
              { label: '总用户', value: latestMetrics?.totalUsers || 0, icon: '👥', color: app.circle.color },
              { label: '活跃用户', value: latestMetrics?.activeUsers || 0, icon: '⚡', color: app.circle.color },
              { label: '评分', value: (latestMetrics?.rating || 0).toFixed(1), icon: '⭐', color: app.circle.color },
              { label: 'PA 投票', value: app.voteCount ?? 0, icon: '🗳️', color: app.circle.color },
              { label: '总访问', value: latestMetrics?.totalVisits || 0, icon: '📊', color: app.circle.color },
            ].map((metric, i) => (
              <Card key={i} className="p-6 text-center">
                <div className="text-3xl mb-3">{metric.icon}</div>
                <div className="text-3xl font-bold mb-2" style={{ color: metric.color }}>
                  {metric.value}
                </div>
                <div className="text-xs text-gray-400 tracking-wide">{metric.label}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Activity Feed */}
      <section className="relative py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-extrabold text-gray-800 mb-6 font-heading">动态</h2>

          <div className="space-y-6">
            {app.posts.map((post) => (
              <Card key={post.id} className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-300 to-amber-400 rounded-xl flex items-center justify-center text-xl flex-shrink-0 shadow-sm">
                    {app.logo ? <img src={app.logo} alt={app.name} className="w-full h-full object-cover rounded-xl" /> : '🤖'}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="font-bold text-gray-800 font-heading">{app.name}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(post.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-gray-600 leading-relaxed mb-4">{post.content}</p>

                    {post.metrics && (
                      <div className="flex gap-6 text-sm mb-4">
                        {Object.entries(post.metrics).map(([key, value]) => (
                          <div key={key}>
                            <span className="text-gray-400">{key}:</span>{' '}
                            <span className="text-orange-600 font-bold">{value as string}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-6 text-sm text-gray-400">
                      <button className="hover:text-orange-500 transition-colors">
                        💬 {post.commentCount} 评论
                      </button>
                      <button className="hover:text-orange-500 transition-colors">
                        ❤️ {post.likeCount} 点赞
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}

            {app.posts.length === 0 && (
              <div className="text-center py-20">
                <div className="text-gray-400 text-lg">暂无动态</div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Public Feedback Section */}
      <section id="feedback-section" className="relative py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-extrabold text-gray-800 font-heading">社区反馈</h2>
            {clientId && (
              <Button asChild size="sm">
                <Link href={`/feedback/${clientId}`}>
                  提交详细反馈
                </Link>
              </Button>
            )}
          </div>

          {/* Inline Comment Box */}
          {clientId && (
            <Card className="p-6 mb-8">
              {user ? (
                <form onSubmit={handleCommentSubmit}>
                  <div className="flex items-center gap-3 mb-4">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-300 to-amber-400 flex items-center justify-center text-sm text-white font-bold">
                        {(user.name || 'U')[0]}
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-700">{user.name || '匿名用户'}</span>
                    <StarPicker value={commentRating} onChange={setCommentRating} />
                  </div>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      placeholder="写下你的评价..."
                      maxLength={200}
                      className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm
                                 focus:outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-200
                                 bg-white text-gray-800 placeholder:text-gray-300"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={submitting || !commentText.trim()}
                      className="disabled:cursor-not-allowed"
                    >
                      {submitting ? '提交中...' : '评价'}
                    </Button>
                  </div>
                  {submitMsg && (
                    <p className={`text-xs mt-2 ${submitMsg.includes('失败') || submitMsg.includes('错误') ? 'text-red-500' : 'text-emerald-500'}`}>
                      {submitMsg}
                    </p>
                  )}
                </form>
              ) : (
                <div className="text-center py-3">
                  <a href="/api/auth/login" className="text-orange-500 hover:text-orange-600 text-sm font-medium">
                    登录后评论 →
                  </a>
                </div>
              )}
            </Card>
          )}

          {feedbacks.length > 0 ? (
            <div className="space-y-4">
              {feedbacks.map(fb => (
                <Card key={fb.id} className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-gray-800 font-bold">{fb.agentName}</span>
                        <SourceBadge agentType={fb.agentType} />
                        <span className="text-xs text-gray-300">
                          {new Date(fb.createdAt).toLocaleDateString('zh-CN')}
                        </span>
                      </div>
                      <p className="text-gray-500 text-sm">{fb.summary}</p>
                    </div>
                    <div className="text-amber-500 text-sm shrink-0">
                      {'★'.repeat(fb.overallRating)}{'☆'.repeat(5 - fb.overallRating)}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <div className="text-4xl mb-4">🐰</div>
              <p className="text-gray-400 mb-4">还没有反馈，来做第一个吧！</p>
              {clientId && (
                <Button asChild size="sm">
                  <Link href={`/feedback/${clientId}`}>
                    第一个评价
                  </Link>
                </Button>
              )}
            </Card>
          )}
        </div>
      </section>
    </div>
  )
}
