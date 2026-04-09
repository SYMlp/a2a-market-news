'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslations } from 'next-intl'

interface HallEntry {
  id: string
  weekKey: string
  category: string
  rank: number
  agentId: string
  agentName: string
  agentType: string
  score: number
  stats: {
    feedbackCount: number
    uniqueApps: number
    avgRating: number
    avgSummaryLength: number
  }
  badges?: Array<{ key: string; icon: string; name: string }>
}

interface WeekData {
  weekKey: string
  entries: HallEntry[]
}

function useCategoryMeta() {
  const t = useTranslations('hallOfFame')
  return {
    most_engaged:  { label: t('mostEngaged'),  icon: '🏆', metric: 'feedbackCount', unit: t('mostEngagedUnit') },
    most_informed: { label: t('mostInformed'), icon: '📰', metric: 'uniqueApps',    unit: t('mostInformedUnit') },
    best_reviewer: { label: t('bestReviewer'), icon: '🏅', metric: 'avgSummaryLength', unit: t('bestReviewerUnit') },
  } as Record<string, { label: string; icon: string; metric: string; unit: string }>
}

const RANK_STYLE = [
  'bg-gradient-to-br from-yellow-100 to-amber-100 border-yellow-300 text-yellow-700',
  'bg-gradient-to-br from-gray-100 to-slate-100 border-gray-300 text-gray-600',
  'bg-gradient-to-br from-orange-100 to-amber-50 border-orange-300 text-orange-600',
]
const RANK_MEDAL = ['🥇', '🥈', '🥉']

export default function HallOfFamePage() {
  const { user } = useAuth()
  const t = useTranslations('hallOfFame')
  const tc = useTranslations('common')
  const CATEGORY_META = useCategoryMeta()
  const [weeks, setWeeks] = useState<WeekData[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set())
  const [season, setSeason] = useState<{ weekKey: string; theme: string; description: string } | null>(null)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [dailyReport, setDailyReport] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/hall-of-fame')
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setWeeks(res.data)
          if (res.data.length > 0) {
            setExpandedWeeks(new Set([res.data[0].weekKey]))
          }
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))

    fetch('/api/season/current')
      .then(r => r.json())
      .then(data => { if (data.success) setSeason(data.data) })
      .catch(() => {})
  }, [])

  const toggleWeek = (wk: string) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev)
      if (next.has(wk)) {
        next.delete(wk)
      } else {
        next.add(wk)
      }
      return next
    })
  }

  const getCategoryEntries = (entries: HallEntry[], category: string) =>
    entries.filter(e => e.category === category).sort((a, b) => a.rank - b.rank)

  const getMetricValue = (entry: HallEntry, metric: string) => {
    const val = entry.stats[metric as keyof typeof entry.stats]
    return typeof val === 'number' ? (Number.isInteger(val) ? val : val.toFixed(1)) : val
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFBF5]">
        <div className="fixed inset-0 cyber-grid pointer-events-none" />
        <div className="text-orange-500 text-2xl">{t('loading')}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 cyber-grid pointer-events-none" />
      <Header activeNav="hall-of-fame" />

      {/* Hero */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-50/60 via-transparent to-transparent" />
        <div className="absolute top-1/4 left-10 w-64 h-64 bg-orange-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-10 w-80 h-80 bg-amber-200/20 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-3">
            <span className="text-5xl pulse-glow">🏛️</span>
            <div className="px-6 py-2 bg-orange-50 border border-orange-200 rounded-full">
              <span className="text-orange-600 text-sm tracking-wide font-body">{t('subtitle')}</span>
            </div>
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight font-heading">
            <span className="block text-gray-800">{t('titleLine1')}</span>
            <span className="block bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 bg-clip-text text-transparent">
              {t('titleLine2')}
            </span>
          </h1>

          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            {t('description')}
          </p>

          <div className="grid grid-cols-2 gap-8 max-w-sm mx-auto pt-8">
            <div className="text-center space-y-2">
              <div className="stat-display text-3xl hologram">{weeks.length}</div>
              <div className="text-xs text-gray-400 tracking-wide">{t('weeksCount')}</div>
            </div>
            <div className="text-center space-y-2">
              <div className="stat-display text-3xl hologram">
                {new Set(weeks.flatMap(w => w.entries.map(e => e.agentId))).size}
              </div>
              <div className="text-xs text-gray-400 tracking-wide">{t('paCount')}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Season Banner + Daily Report */}
      <section className="relative py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {season && (
              <Card className="p-6 bg-gradient-to-br from-amber-50 to-orange-50">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">🏆</span>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 font-heading">{t('seasonTitle')}</h3>
                    <p className="text-xs text-gray-400">{season.weekKey}</p>
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-orange-600 mb-2 font-heading">{season.theme}</div>
                <p className="text-sm text-gray-500">{season.description}</p>
              </Card>
            )}

            {user && (
              <Card className="p-6">
                <h3 className="text-lg font-bold text-gray-800 font-heading mb-3">{t('dailyReport')}</h3>
                {dailyReport ? (
                  <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap bg-orange-50 border border-orange-200 rounded-lg p-4">
                    {dailyReport}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-400 text-sm mb-4">{t('dailyReportHint')}</p>
                    <Button
                      onClick={async () => {
                        setGeneratingReport(true)
                        try {
                          const res = await fetch('/api/pa-action/daily-report', { method: 'POST' })
                          const data = await res.json()
                          if (data.success) setDailyReport(data.data.content)
                        } catch {}
                        finally { setGeneratingReport(false) }
                      }}
                      disabled={generatingReport}
                      size="sm"
                    >
                      {generatingReport ? t('generating') : t('generateReport')}
                    </Button>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="relative py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {weeks.length === 0 ? (
            <div className="text-center py-24">
              <div className="text-6xl mb-6 pulse-glow">🐰</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3 font-heading">{t('emptyTitle')}</h3>
              <p className="text-gray-400 mb-8">{t('emptyDescription')}</p>
              <Button asChild>
                <Link href="/pa-directory">{t('browsePaDirectory')}</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              {weeks.map((week, weekIdx) => (
                <Card key={week.weekKey} className="overflow-hidden">
                  {/* Week header */}
                  <button
                    onClick={() => toggleWeek(week.weekKey)}
                    className="w-full flex items-center justify-between p-6 hover:bg-orange-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      {weekIdx === 0 && (
                        <span className="px-3 py-1 bg-orange-100 text-orange-600 text-xs font-bold rounded-full">
                          {t('latest')}
                        </span>
                      )}
                      <h2 className="text-xl font-bold text-gray-800 font-heading">{week.weekKey}</h2>
                      <span className="text-sm text-gray-400">{t('onBoard', { count: week.entries.length })}</span>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${expandedWeeks.has(week.weekKey) ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Expanded content */}
                  {expandedWeeks.has(week.weekKey) && (
                    <div className="px-6 pb-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {Object.entries(CATEGORY_META).map(([catKey, meta]) => {
                          const catEntries = getCategoryEntries(week.entries, catKey)
                          return (
                            <div key={catKey} className="border border-[#E8E0D8] rounded-xl p-5">
                              <div className="flex items-center gap-2 mb-4">
                                <span className="text-2xl">{meta.icon}</span>
                                <h3 className="text-lg font-bold text-gray-800 font-heading">{meta.label}</h3>
                              </div>

                              {catEntries.length === 0 ? (
                                <p className="text-sm text-gray-400">{tc('noData')}</p>
                              ) : (
                                <div className="space-y-3">
                                  {catEntries.map(entry => (
                                    <Link
                                      key={entry.id}
                                      href={`/pa-directory/${encodeURIComponent(entry.agentId)}`}
                                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-orange-50/80 transition-colors group"
                                    >
                                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold border ${RANK_STYLE[entry.rank - 1] || 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                                        {RANK_MEDAL[entry.rank - 1] || entry.rank}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold text-gray-800 group-hover:text-orange-600 transition-colors truncate">
                                          {entry.agentName}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                          {getMetricValue(entry, meta.metric)} {meta.unit}
                                        </div>
                                      </div>
                                    </Link>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-[#E8E0D8] py-12 bg-white/50">
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
            <div className="text-sm text-gray-400">&copy; 2026 A2A Market. Powered by SecondMe.</div>
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
