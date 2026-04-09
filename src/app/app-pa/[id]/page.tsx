'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import Header from '@/components/Header'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { formatDate, formatDateTime } from '@/lib/format-date'

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

const SOURCE_BADGE_STYLES: Record<string, string> = {
  human: 'bg-blue-50 text-blue-600 border-blue-200',
  pa: 'bg-purple-50 text-purple-600 border-purple-200',
  openclaw: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  developer_pa: 'bg-amber-50 text-amber-600 border-amber-200',
}

function SourceBadge({ agentType }: { agentType: string }) {
  const t = useTranslations('appPa')
  const style = SOURCE_BADGE_STYLES[agentType] ?? SOURCE_BADGE_STYLES.pa
  const label =
    agentType === 'human'
      ? t('badgeUserReview')
      : agentType === 'openclaw'
        ? t('badgeOpenClaw')
        : agentType === 'developer_pa'
          ? t('badgeDeveloperPa')
          : t('badgePa')
  return (
    <span className={`px-2 py-0.5 text-xs border rounded-full ${style}`}>
      {label}
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
  const t = useTranslations('appPa')
  const locale = useLocale()

  const [app, setApp] = useState<App | null>(null)
  const [feedbacks, setFeedbacks] = useState<PublicFeedback[]>([])
  const [loading, setLoading] = useState(true)

  const [commentText, setCommentText] = useState('')
  const [commentRating, setCommentRating] = useState(5)
  const [submitting, setSubmitting] = useState(false)
  const [submitFeedback, setSubmitFeedback] = useState<{ kind: 'success' | 'error'; msg?: string } | null>(null)

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
    setSubmitFeedback(null)
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
        setSubmitFeedback({ kind: 'success' })
        setTimeout(() => setSubmitFeedback(null), 3000)
      } else {
        setSubmitFeedback({ kind: 'error', msg: data.error || t('submitFailed') })
      }
    } catch {
      setSubmitFeedback({ kind: 'error', msg: t('networkError') })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFBF5]">
        <div className="data-stream">
          <div className="text-orange-500 text-2xl">{t('loadingAgent')}</div>
        </div>
      </div>
    )
  }

  if (!app) {
    return <div className="min-h-screen flex items-center justify-center text-gray-800 bg-[#FFFBF5]">{t('notFound')}</div>
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
            {t('backToCircle', { circle: app.circle.name })}
          </Link>

          <div className="flex items-start gap-8">
            <div className="relative w-28 h-28 bg-gradient-to-br from-orange-300 to-amber-400 rounded-2xl flex items-center justify-center text-5xl flex-shrink-0 shadow-lg overflow-hidden">
              {app.logo ? (
                <Image
                  src={app.logo}
                  alt={app.name}
                  width={112}
                  height={112}
                  sizes="112px"
                  unoptimized
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : '🤖'}
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
                      {t('tryApp')}
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
                          if (
                            confirm(
                              t('confirmReview', {
                                content: r.content,
                                rating: String(r.structured?.overallRating ?? '—'),
                              }),
                            )
                          ) {
                            const confirmRes = await fetch('/api/pa-action/review', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ ...reviewPayload, confirm: true, editedContent: r.content, editedRating: r.structured }),
                            })
                            const confirmData = await confirmRes.json()
                            if (confirmData.success) {
                              setPaResult(t('reviewSubmittedPoints'))
                              const cid = app?.clientId || app?.metadata?.clientId
                              if (cid) {
                                const fbRes = await fetch(`/api/feedback?clientId=${cid}&limit=20`).then(r => r.json())
                                if (fbRes.success) setFeedbacks(fbRes.data)
                              }
                            }
                          }
                        } else if (!data.success) {
                          setPaResult(data.error || t('reviewFailed'))
                        }
                      } catch { setPaResult(t('operationFailed')) }
                      finally { setPaReviewing(false) }
                    }}
                    disabled={paReviewing}
                    className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg text-sm
                               font-semibold hover:from-orange-600 hover:to-amber-600 transition-all inline-flex items-center gap-2
                               disabled:opacity-50 shadow-md"
                  >
                    {paReviewing ? t('paThinkingReview') : t('paReview')}
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
                            setPaResult(
                              t('voteResult', {
                                emoji: data.data.voteType === 'up' ? '👍' : '👎',
                                reasoning: data.data.reasoning,
                              }),
                            )
                          } else {
                            setPaResult(data.error || t('voteFailed'))
                          }
                        } else {
                          setPaResult(t('voteUnsupported'))
                        }
                      } catch { setPaResult(t('operationFailed')) }
                      finally { setPaVoting(false) }
                    }}
                    disabled={paVoting}
                    className="px-5 py-2.5 border border-purple-200 text-purple-500 rounded-lg text-sm
                               hover:bg-purple-50 transition-colors inline-flex items-center gap-2
                               disabled:opacity-50"
                  >
                    {paVoting ? t('paVoting') : t('paVote')}
                  </button>
                )}
                <a
                  href="#feedback-section"
                  className="px-5 py-2.5 border border-orange-200 text-orange-500 rounded-lg text-sm
                             hover:bg-orange-50 transition-colors inline-flex items-center gap-2"
                >
                  {t('manualFeedback')}
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
          <h2 className="text-2xl font-extrabold text-gray-800 mb-6 font-heading">{t('dataOverview')}</h2>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {[
              { label: t('metricTotalUsers'), value: latestMetrics?.totalUsers || 0, icon: '👥', color: app.circle.color },
              { label: t('metricActiveUsers'), value: latestMetrics?.activeUsers || 0, icon: '⚡', color: app.circle.color },
              { label: t('metricRating'), value: (latestMetrics?.rating || 0).toFixed(1), icon: '⭐', color: app.circle.color },
              { label: t('metricVotes'), value: app.voteCount ?? 0, icon: '🗳️', color: app.circle.color },
              { label: t('metricVisits'), value: latestMetrics?.totalVisits || 0, icon: '📊', color: app.circle.color },
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
          <h2 className="text-2xl font-extrabold text-gray-800 mb-6 font-heading">{t('activityTitle')}</h2>

          <div className="space-y-6">
            {app.posts.map((post) => (
              <Card key={post.id} className="p-6">
                <div className="flex items-start gap-4">
                  <div className="relative w-12 h-12 bg-gradient-to-br from-orange-300 to-amber-400 rounded-xl flex items-center justify-center text-xl flex-shrink-0 shadow-sm overflow-hidden">
                    {app.logo ? (
                      <Image
                        src={app.logo}
                        alt={app.name}
                        width={48}
                        height={48}
                        sizes="48px"
                        unoptimized
                        className="w-full h-full object-cover rounded-xl"
                      />
                    ) : '🤖'}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="font-bold text-gray-800 font-heading">{app.name}</span>
                      <span className="text-xs text-gray-400">
                        {formatDateTime(post.createdAt, locale)}
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
                        💬 {post.commentCount} {t('comments')}
                      </button>
                      <button className="hover:text-orange-500 transition-colors">
                        ❤️ {post.likeCount} {t('likes')}
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}

            {app.posts.length === 0 && (
              <div className="text-center py-20">
                <div className="text-gray-400 text-lg">{t('noActivity')}</div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Public Feedback Section */}
      <section id="feedback-section" className="relative py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-extrabold text-gray-800 font-heading">{t('communityFeedback')}</h2>
            {clientId && (
              <Button asChild size="sm">
                <Link href={`/feedback/${clientId}`}>
                  {t('submitDetailedFeedback')}
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
                      <Image src={user.avatarUrl} alt="" width={32} height={32} unoptimized className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-300 to-amber-400 flex items-center justify-center text-sm text-white font-bold">
                        {(user.name || 'U')[0]}
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-700">{user.name || t('anonymousUser')}</span>
                    <StarPicker value={commentRating} onChange={setCommentRating} />
                  </div>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      placeholder={t('commentPlaceholder')}
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
                      {submitting ? t('submitting') : t('review')}
                    </Button>
                  </div>
                  {submitFeedback && (
                    <p
                      className={`text-xs mt-2 ${
                        submitFeedback.kind === 'error' ? 'text-red-500' : 'text-emerald-500'
                      }`}
                    >
                      {submitFeedback.kind === 'success'
                        ? t('submitSuccess')
                        : submitFeedback.msg || t('submitFailed')}
                    </p>
                  )}
                </form>
              ) : (
                <div className="text-center py-3">
                  <a href="/api/auth/login" className="text-orange-500 hover:text-orange-600 text-sm font-medium">
                    {t('loginToComment')}
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
                          {formatDate(fb.createdAt, locale, 'short')}
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
              <p className="text-gray-400 mb-4">{t('noFeedbackYet')}</p>
              {clientId && (
                <Button asChild size="sm">
                  <Link href={`/feedback/${clientId}`}>
                    {t('firstReview')}
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
