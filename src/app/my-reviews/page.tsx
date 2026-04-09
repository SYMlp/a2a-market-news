'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useLocale, useTranslations } from 'next-intl'
import { formatDate as formatDateUtil } from '@/lib/format-date'

interface ReviewItem {
  id: string
  appName: string
  appClientId: string
  overallRating: number
  summary: string
  source: string
  status: string
  createdAt: string
  payload: Record<string, unknown> | null
}

interface EditState {
  summary: string
  overallRating: number
}

function renderStars(rating: number) {
  const rounded = Math.round(rating)
  return '★'.repeat(rounded) + '☆'.repeat(5 - rounded)
}

function sourceBadge(source: string, t: (key: string) => string) {
  const isHuman = source === 'human_comment' || source === 'human_edited'
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
        isHuman
          ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
          : 'bg-amber-50 border-amber-200 text-amber-600'
      }`}
    >
      {isHuman ? t('sourceConfirmed') : t('sourceDraft')}
    </span>
  )
}

export default function MyReviewsPage() {
  const { user, loading: authLoading } = useAuth()
  const locale = useLocale()
  const t = useTranslations('myReviews')
  const tc = useTranslations('common')
  const formatDate = (iso: string) => formatDateUtil(iso, locale)
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState>({ summary: '', overallRating: 1 })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [paLoading, setPaLoading] = useState(false)

  const fetchReviews = useCallback(async () => {
    try {
      const res = await fetch('/api/my-reviews')
      const data = await res.json()
      if (data.success) setReviews(data.data)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) fetchReviews()
    else setLoading(false)
  }, [user, fetchReviews])

  const totalReviews = reviews.length
  const avgRating = totalReviews > 0
    ? reviews.reduce((sum, r) => sum + r.overallRating, 0) / totalReviews
    : 0
  const appsReviewed = new Set(reviews.map(r => r.appClientId)).size

  const openEdit = (review: ReviewItem) => {
    if (expandedId === review.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(review.id)
    setEditState({ summary: review.summary, overallRating: review.overallRating })
    setError('')
  }

  const handleSave = async () => {
    if (!expandedId) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/my-reviews/${expandedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: editState.summary,
          overallRating: editState.overallRating,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setReviews(prev =>
          prev.map(r =>
            r.id === expandedId
              ? { ...r, summary: editState.summary, overallRating: editState.overallRating, source: 'human_edited' }
              : r
          )
        )
        setExpandedId(null)
      } else {
        setError(data.error || t('saveFailed'))
      }
    } catch {
      setError(tc('networkError'))
    } finally {
      setSaving(false)
    }
  }

  const handlePaDraft = async (review: ReviewItem) => {
    setPaLoading(true)
    setError('')
    try {
      const res = await fetch('/api/pa/suggest-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formType: 'review',
          context: { appName: review.appName, appClientId: review.appClientId },
        }),
      })
      const data = await res.json()
      if (data.success && data.suggestions) {
        const s = data.suggestions as Record<string, { value: string | number }>
        setEditState(prev => ({
          summary: s.summary?.value ? String(s.summary.value) : prev.summary,
          overallRating: s.overallRating?.value ? Number(s.overallRating.value) : prev.overallRating,
        }))
        if (expandedId !== review.id) {
          setExpandedId(review.id)
        }
      } else {
        setError(data.error || t('paSuggestFailed'))
      }
    } catch {
      setError(tc('networkError'))
    } finally {
      setPaLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen">
        <div className="fixed inset-0 cyber-grid pointer-events-none" />
        <Header activeNav="my-reviews" />
        <main className="relative py-20 flex items-center justify-center">
          <p className="text-gray-500">{t('loading')}</p>
        </main>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen">
        <div className="fixed inset-0 cyber-grid pointer-events-none" />
        <Header activeNav="my-reviews" />
        <main className="relative py-20">
          <div className="max-w-2xl mx-auto px-4 text-center">
            <p className="text-gray-600 mb-4">{t('loginPrompt')}</p>
            <Button asChild size="sm">
              <Link href="/api/auth/login">{tc('login')}</Link>
            </Button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 cyber-grid pointer-events-none" />

      <Header activeNav="my-reviews" />

      <main className="relative py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block data-stream">
                <div className="text-orange-500 text-xl">{t('loading')}</div>
              </div>
            </div>
          ) : (
            <>
              {/* Page heading */}
              <div className="mb-10">
                <h1 className="text-3xl font-extrabold text-gray-800 font-heading mb-2">{t('pageTitle')}</h1>
                <p className="text-gray-400 text-sm">{t('pageSubtitle')}</p>
              </div>

              {/* Stats bar */}
              <div className="grid grid-cols-3 gap-6 mb-12">
                {[
                  { label: t('statTotal'), value: totalReviews, icon: '💬', gradient: 'from-blue-400 to-blue-500' },
                  { label: t('statAvg'), value: avgRating > 0 ? avgRating.toFixed(1) : '-', icon: '⭐', gradient: 'from-amber-400 to-orange-500' },
                  { label: t('statApps'), value: appsReviewed, icon: '📦', gradient: 'from-purple-400 to-purple-500' },
                ].map((s, i) => (
                  <Card key={i} className="p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{s.icon}</span>
                      <span className="text-xs text-gray-400 tracking-wide">{s.label}</span>
                    </div>
                    <div className={`text-3xl font-bold bg-gradient-to-r ${s.gradient} bg-clip-text text-transparent`}>
                      {s.value}
                    </div>
                  </Card>
                ))}
              </div>

              {/* Review list */}
              {reviews.length === 0 ? (
                <Card className="p-16 text-center">
                  <div className="text-5xl mb-4">📝</div>
                  <p className="text-gray-500 text-lg mb-2">{t('emptyTitle')}</p>
                  <p className="text-gray-300 text-sm">{t('emptyDesc')}</p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {reviews.map(review => {
                    const isExpanded = expandedId === review.id
                    return (
                      <Card key={review.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                        <div className="p-6">
                          {/* Review header */}
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-1">
                                <span className="text-lg font-bold text-gray-800 truncate">
                                  {review.appName}
                                </span>
                                {sourceBadge(review.source, t)}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-gray-400">
                                <span>{formatDate(review.createdAt)}</span>
                                <span className="text-gray-200">·</span>
                                <span className={`px-2 py-0.5 rounded-full border text-[11px] ${
                                  review.status === 'published'
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                                    : 'bg-gray-50 border-gray-200 text-gray-400'
                                }`}>
                                  {review.status === 'published' ? t('statusPublished') : review.status}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 shrink-0">
                              <div className="text-center">
                                <div className="text-amber-500 text-sm tracking-wider">
                                  {renderStars(review.overallRating)}
                                </div>
                                <div className="text-xs text-gray-300">{review.overallRating}/5</div>
                              </div>
                            </div>
                          </div>

                          {/* Summary preview */}
                          <p className="text-gray-500 text-sm line-clamp-2 mb-4">{review.summary}</p>

                          {/* Action buttons */}
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => openEdit(review)}
                              className="px-4 py-2 border border-orange-200 text-orange-500 text-xs tracking-wide rounded-lg
                                hover:bg-orange-50 transition-colors"
                            >
                              {isExpanded ? t('collapse') : t('edit')}
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePaDraft(review)}
                              disabled={paLoading}
                              className="inline-flex items-center gap-2 px-4 py-2 border border-indigo-200 text-indigo-600
                                text-xs tracking-wide rounded-lg
                                hover:bg-indigo-50 transition-colors disabled:opacity-50"
                            >
                              {paLoading ? (
                                <>
                                  <span className="w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                                  {t('paDrafting')}
                                </>
                              ) : (
                                t('paHelpDraft')
                              )}
                            </button>
                          </div>

                          {/* Inline edit panel */}
                          {isExpanded && (
                            <div className="mt-5 pt-5 border-t border-[#E8E0D8] space-y-4">
                              {error && (
                                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">
                                  {error}
                                </div>
                              )}

                              {/* Rating selector */}
                              <div>
                                <label className="block text-orange-600 text-xs tracking-widest mb-2 font-semibold">
                                  {t('ratingLabel')}
                                </label>
                                <div className="flex gap-2">
                                  {[1, 2, 3, 4, 5].map(n => (
                                    <button
                                      key={n}
                                      type="button"
                                      onClick={() => setEditState(s => ({ ...s, overallRating: n }))}
                                      className={`w-10 h-10 rounded-lg border text-lg transition-all ${
                                        n <= editState.overallRating
                                          ? 'border-amber-400 bg-amber-50 text-amber-500'
                                          : 'border-[#E8E0D8] text-gray-300 hover:border-amber-200'
                                      }`}
                                    >
                                      ★
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Summary editor */}
                              <div>
                                <label className="block text-orange-600 text-xs tracking-widest mb-2 font-semibold">
                                  {t('contentLabel')}
                                </label>
                                <textarea
                                  rows={4}
                                  value={editState.summary}
                                  onChange={e => setEditState(s => ({ ...s, summary: e.target.value }))}
                                  className="w-full bg-[#FFFBF5] border border-[#E8E0D8] text-gray-800 px-4 py-3 rounded-xl
                                    focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100
                                    placeholder:text-gray-300 transition-all text-sm"
                                  placeholder={t('contentPlaceholder')}
                                />
                              </div>

                              {/* Save / Cancel */}
                              <div className="flex items-center gap-3">
                                <Button
                                  size="sm"
                                  onClick={handleSave}
                                  disabled={saving || !editState.summary.trim()}
                                >
                                  {saving ? t('saving') : t('save')}
                                </Button>
                                <button
                                  type="button"
                                  onClick={() => setExpandedId(null)}
                                  className="px-4 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                  {tc('cancel')}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
