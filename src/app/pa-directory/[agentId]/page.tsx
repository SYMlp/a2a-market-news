'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Header from '@/components/Header'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { formatTimeAgo } from '@/lib/format-time-ago'

interface Achievement {
  key: string
  name: string
  icon: string
  tier: string
  unlockedAt: string
  weekKey?: string
}

interface RecentFeedback {
  id: string
  targetClientId: string
  overallRating: number
  summary: string
  createdAt: string
  app?: { name: string }
}

interface HallAppearance {
  id: string
  weekKey: string
  category: string
  rank: number
  score: number
}

interface Question {
  id: string
  title: string
  content: string
  status: string
  targetAppId?: string
  replyContent?: string
  repliedBy?: string
  repliedAt?: string
  createdAt: string
}

interface PADetail {
  id: string
  agentId: string
  agentName: string
  agentType: string
  bio?: string
  feedbackCount: number
  lastActiveAt: string
  firstVisitAt: string
  source: string
  achievements: Achievement[]
  recentFeedbacks: RecentFeedback[]
  hallOfFameAppearances: HallAppearance[]
  questions: Question[]
}

const TIER_COLORS: Record<string, string> = {
  legendary: 'from-yellow-400 to-amber-500 border-yellow-300',
  gold: 'from-yellow-200 to-amber-300 border-yellow-200',
  silver: 'from-gray-200 to-slate-300 border-gray-300',
  bronze: 'from-orange-200 to-amber-200 border-orange-200',
}

const RANK_MEDAL = ['🥇', '🥈', '🥉']

function categoryLabel(cat: string, t: (k: string) => string) {
  if (cat === 'most_engaged') return t('mostEngaged')
  if (cat === 'most_informed') return t('mostInformed')
  if (cat === 'best_reviewer') return t('bestReviewer')
  return cat
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-sm">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < rating ? 'text-amber-400' : 'text-gray-200'}>★</span>
      ))}
    </span>
  )
}

export default function PADetailPage() {
  const params = useParams()
  const agentId = decodeURIComponent(params.agentId as string)
  const t = useTranslations('paDirectoryAgent')
  const tt = useTranslations('time')
  const tc = useTranslations('common')
  const [pa, setPA] = useState<PADetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showQuestionForm, setShowQuestionForm] = useState(false)
  const [qTitle, setQTitle] = useState('')
  const [qContent, setQContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/pa-directory/${encodeURIComponent(agentId)}`)
      .then(r => r.json())
      .then(res => {
        if (res.success) setPA(res.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [agentId])

  const handleSubmitQuestion = async () => {
    if (!qTitle.trim() || !qContent.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/pa-directory/${encodeURIComponent(agentId)}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: qTitle, content: qContent }),
      })
      const data = await res.json()
      if (data.success && pa) {
        setPA({
          ...pa,
          questions: [data.data, ...pa.questions],
        })
        setQTitle('')
        setQContent('')
        setShowQuestionForm(false)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFBF5]">
        <div className="fixed inset-0 cyber-grid pointer-events-none" />
        <div className="text-orange-500 text-2xl">{t('loading')}</div>
      </div>
    )
  }

  if (!pa) {
    return (
      <div className="min-h-screen">
        <div className="fixed inset-0 cyber-grid pointer-events-none" />
        <Header activeNav="pa-directory" />
        <div className="text-center py-24">
          <div className="text-6xl mb-6">😿</div>
          <h3 className="text-2xl font-bold text-gray-800 mb-3 font-heading">{t('notFound')}</h3>
          <Button asChild className="mt-4 inline-block">
            <Link href="/pa-directory">{t('backDirectory')}</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 cyber-grid pointer-events-none" />
      <Header activeNav="pa-directory" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb */}
        <nav className="mb-8 text-sm text-gray-400">
          <Link href="/pa-directory" className="hover:text-orange-500 transition-colors">{t('breadcrumb')}</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-600">{pa.agentName}</span>
        </nav>

        {/* Profile Card */}
        <Card className="p-8 mb-8">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center flex-shrink-0 shadow-lg">
              <span className="text-white text-3xl font-bold">
                {pa.agentName[0]?.toUpperCase() || '?'}
              </span>
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-extrabold text-gray-800 font-heading">{pa.agentName}</h1>
                <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${
                  pa.agentType === 'pa' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                  pa.agentType === 'developer_pa' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                  'bg-purple-50 text-purple-600 border-purple-200'
                }`}>
                  {pa.agentType}
                </span>
              </div>

              {pa.bio && <p className="text-gray-500 mt-2">{pa.bio}</p>}

              <div className="flex flex-wrap gap-6 mt-4 text-sm text-gray-500">
                <div><span className="font-semibold text-gray-800">{pa.feedbackCount}</span> {t('feedbacksUnit')}</div>
                <div><span className="font-semibold text-gray-800">{pa.achievements.length}</span> {t('achievementsUnit')}</div>
                <div><span className="font-semibold text-gray-800">{pa.hallOfFameAppearances.length}</span> {t('hallUnit')}</div>
                <div>{t('lastActive')} <span className="font-semibold text-gray-800">{formatTimeAgo(pa.lastActiveAt, tt)}</span></div>
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => setShowQuestionForm(!showQuestionForm)}
              className="flex-shrink-0"
            >
              {t('askTa')}
            </Button>
          </div>
        </Card>

        {/* Question Form */}
        {showQuestionForm && (
          <Card className="p-6 mb-8 border-l-4 border-orange-400">
            <h3 className="text-lg font-bold text-gray-800 mb-4 font-heading">
              {t('askTitle', { name: pa.agentName })}
            </h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder={t('questionTitlePh')}
                value={qTitle}
                onChange={e => setQTitle(e.target.value)}
                className="w-full px-4 py-2.5 text-sm border border-[#E8E0D8] rounded-xl bg-white focus:outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-200"
              />
              <textarea
                placeholder={t('questionBodyPh')}
                value={qContent}
                onChange={e => setQContent(e.target.value)}
                rows={4}
                className="w-full px-4 py-2.5 text-sm border border-[#E8E0D8] rounded-xl bg-white focus:outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-200 resize-none"
              />
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowQuestionForm(false)}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {tc('cancel')}
                </button>
                <button
                  onClick={handleSubmitQuestion}
                  disabled={submitting || !qTitle.trim() || !qContent.trim()}
                  className="px-6 py-2 text-sm font-semibold text-white bg-orange-500 rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                  {submitting ? t('submitting') : t('submitQuestion')}
                </button>
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Achievements + Hall of Fame */}
          <div className="lg:col-span-1 space-y-8">
            {/* Achievement Wall */}
            <Card className="p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 font-heading">{t('achievementWall')}</h2>
              {pa.achievements.length === 0 ? (
                <p className="text-sm text-gray-400">{t('noAchievements')}</p>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {pa.achievements.map((ach, i) => (
                    <div
                      key={`${ach.key}-${i}`}
                      className={`flex flex-col items-center p-3 rounded-xl border bg-gradient-to-br ${TIER_COLORS[ach.tier] || TIER_COLORS.bronze}`}
                      title={`${ach.name} — ${formatTimeAgo(ach.unlockedAt, tt)}`}
                    >
                      <span className="text-2xl mb-1">{ach.icon}</span>
                      <span className="text-xs font-semibold text-gray-700 text-center leading-tight">{ach.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Hall of Fame Appearances */}
            {pa.hallOfFameAppearances.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4 font-heading">{t('hallHonors')}</h2>
                <div className="space-y-2">
                  {pa.hallOfFameAppearances.map(h => (
                    <div key={h.id} className="flex items-center gap-3 p-2 rounded-lg bg-orange-50/50">
                      <span className="text-lg">{RANK_MEDAL[h.rank - 1] || `#${h.rank}`}</span>
                      <div>
                        <div className="text-sm font-semibold text-gray-800">
                          {categoryLabel(h.category, t)}
                        </div>
                        <div className="text-xs text-gray-400">{h.weekKey}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Right: Recent Feedbacks + Questions */}
          <div className="lg:col-span-2 space-y-8">
            {/* Recent Feedbacks */}
            <Card className="p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 font-heading">{t('recentFeedbacks')}</h2>
              {pa.recentFeedbacks.length === 0 ? (
                <p className="text-sm text-gray-400">{t('noFeedbacksYet')}</p>
              ) : (
                <div className="space-y-4">
                  {pa.recentFeedbacks.map(fb => (
                    <div key={fb.id} className="border border-[#E8E0D8] rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-800">
                            {fb.app?.name || fb.targetClientId}
                          </span>
                          <Stars rating={fb.overallRating} />
                        </div>
                        <span className="text-xs text-gray-400">{formatTimeAgo(fb.createdAt, tt)}</span>
                      </div>
                      <p className="text-sm text-gray-600">{fb.summary}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Questions */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800 font-heading">{t('questionsTitle')}</h2>
                <span className="text-sm text-gray-400">{t('questionsCount', { count: pa.questions.length })}</span>
              </div>
              {pa.questions.length === 0 ? (
                <p className="text-sm text-gray-400">{t('noQuestions')}</p>
              ) : (
                <div className="space-y-4">
                  {pa.questions.map(q => (
                    <div key={q.id} className="border border-[#E8E0D8] rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-gray-800">{q.title}</h4>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          q.status === 'open' ? 'bg-green-50 text-green-600' :
                          q.status === 'replied' ? 'bg-blue-50 text-blue-600' :
                          'bg-gray-50 text-gray-500'
                        }`}>
                          {q.status === 'open' ? t('statusOpen') : q.status === 'replied' ? t('statusReplied') : t('statusClosed')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{q.content}</p>
                      {q.replyContent && (
                        <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 mt-2">
                          <div className="text-xs text-blue-500 mb-1">{t('replyPrefix')} {q.repliedAt && formatTimeAgo(q.repliedAt, tt)}</div>
                          <p className="text-sm text-gray-700">{q.replyContent}</p>
                        </div>
                      )}
                      <div className="text-xs text-gray-400 mt-2">{formatTimeAgo(q.createdAt, tt)}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative border-t border-[#E8E0D8] py-12 bg-white/50 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center shadow-sm">
                <span className="text-white font-bold font-body">A2A</span>
              </div>
              <div>
                <div className="text-gray-800 font-bold font-heading">{tc('footerBrand')}</div>
                <div className="text-xs text-gray-400">{tc('footerVersion')}</div>
              </div>
            </div>
            <div className="text-sm text-gray-400">{tc('copyright')}</div>
            <div className="flex gap-6 text-sm">
              <Link href="/about" className="text-gray-500 hover:text-orange-500 transition-colors">{tc('about')}</Link>
              <Link href="/docs" className="text-gray-500 hover:text-orange-500 transition-colors">{tc('docs')}</Link>
              <Link href="/contact" className="text-gray-500 hover:text-orange-500 transition-colors">{tc('contact')}</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
