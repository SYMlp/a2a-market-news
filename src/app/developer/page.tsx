'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import Header from '@/components/Header'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface LatestFeedback {
  id: string
  agentName: string
  agentType: string
  overallRating: number
  summary: string
  createdAt: string
}

interface AppItem {
  id: string
  name: string
  description: string
  clientId: string | null
  status: string
  circle: { name: string; slug: string; icon?: string }
  _count: { feedbacks: number }
  avgRating: number
  latestFeedback: LatestFeedback | null
  createdAt: string
}

interface PracticeItem {
  id: string
  title: string
  summary: string
  category: string
  tags: string[]
  viewCount: number
  likeCount: number
  status: string
  createdAt: string
}

interface DeveloperStats {
  totalApps: number
  totalFeedbacks: number
  avgRating: number
  unreadCount: number
}

function renderStars(rating: number) {
  const rounded = Math.round(rating)
  return '★'.repeat(rounded) + '☆'.repeat(5 - rounded)
}

export default function DeveloperDashboard() {
  const { user, loading: authLoading } = useAuth()
  const t = useTranslations('developerDashboard')
  const tc = useTranslations('common')
  const tp = useTranslations('practiceNew')
  const agentTypeLabels = useMemo(
    () => ({
      human: t('agentHuman'),
      pa: t('agentPa'),
      openclaw: 'OpenClaw',
      developer_pa: t('agentDeveloperPa'),
    }),
    [t],
  )
  const [stats, setStats] = useState<DeveloperStats | null>(null)
  const [apps, setApps] = useState<AppItem[]>([])
  const [practices, setPractices] = useState<PracticeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)

  useEffect(() => {
    const url = showArchived ? '/api/developer/apps?includeArchived=true' : '/api/developer/apps'
    const practicesUrl = user?.id ? `/api/practices?authorId=${user.id}` : null

    const fetches: Promise<unknown>[] = [
      fetch('/api/developer/stats').then(r => r.json()),
      fetch(url).then(r => r.json()),
    ]
    if (practicesUrl) {
      fetches.push(fetch(practicesUrl).then(r => r.json()))
    }

    Promise.all(fetches)
      .then(([statsData, appsData, practicesData]: unknown[]) => {
        const s = statsData as { success?: boolean; data?: DeveloperStats }
        const a = appsData as { success?: boolean; data?: AppItem[] }
        const p = practicesData as { success?: boolean; data?: PracticeItem[] } | undefined
        if (s.success) setStats(s.data ?? null)
        if (a.success) setApps(a.data ?? [])
        if (p?.success && p.data) setPractices(p.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))

    fetch('/api/developer/notifications/mark-read', { method: 'POST' }).catch(() => {})
  }, [showArchived, user?.id])

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 cyber-grid pointer-events-none" />

      <Header activeNav="developer" />

      <main className="relative py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading || authLoading ? (
            <div className="text-center py-20">
              <div className="inline-block data-stream">
                <div className="text-orange-500 text-xl">{tc('loading')}</div>
              </div>
            </div>
          ) : (
            <>
              {/* Welcome */}
              <div className="mb-10">
                <h1 className="text-3xl font-extrabold text-gray-800 font-heading mb-2">
                  {user?.name ? t('welcomeBackNamed', { name: user.name }) : t('welcomeBack')}
                </h1>
                <p className="text-gray-400 text-sm">{t('subtitle')}</p>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
                {[
                  { label: t('statMyApps'), value: stats?.totalApps ?? 0, icon: '📦', gradient: 'from-blue-400 to-blue-500' },
                  { label: t('statTotalFeedbacks'), value: stats?.totalFeedbacks ?? 0, icon: '💬', gradient: 'from-purple-400 to-purple-500' },
                  { label: t('statAvgRating'), value: (stats?.avgRating ?? 0).toFixed(1), icon: '⭐', gradient: 'from-amber-400 to-orange-500' },
                  { label: t('statUnread'), value: stats?.unreadCount ?? 0, icon: '🔔', gradient: 'from-rose-400 to-pink-500' },
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

              {/* Apps Section */}
              <div className="mb-8 flex flex-wrap justify-between items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-800 font-heading">{t('myApps')}</h2>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-500">
                    <input
                      type="checkbox"
                      checked={showArchived}
                      onChange={e => setShowArchived(e.target.checked)}
                      className="rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                    />
                    {t('showArchived')}
                  </label>
                  <Button asChild size="sm">
                    <Link href="/register">{t('registerNewApp')}</Link>
                  </Button>
                </div>
              </div>

              {apps.length === 0 ? (
                <Card className="p-16 text-center">
                  <div className="text-5xl mb-4">🚀</div>
                  <p className="text-gray-500 text-lg mb-2">{t('emptyAppsTitle')}</p>
                  <p className="text-gray-300 text-sm mb-6">{t('emptyAppsDesc')}</p>
                  <Button asChild>
                    <Link href="/register">{t('registerFirstApp')}</Link>
                  </Button>
                </Card>
              ) : (
                <div className="space-y-6">
                  {apps.map(app => (
                    <Card key={app.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                      <div className="p-6">
                        {/* App header row */}
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <Link href={`/app-pa/${app.id}`} className="text-lg font-bold text-gray-800 hover:text-orange-500 transition-colors truncate">
                                {app.name}
                              </Link>
                              <span className={`circle-badge ${app.circle.slug}`}>
                                {app.circle.icon ?? ''} {app.circle.name}
                              </span>
                              <span className={`px-2 py-0.5 text-xs rounded-full ${
                                app.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                  : app.status === 'archived'
                                  ? 'bg-gray-100 text-gray-500 border border-gray-200'
                                  : 'bg-amber-50 text-amber-600 border border-amber-200'
                              }`}>
                                {app.status === 'active' ? t('statusActive') : app.status === 'archived' ? t('statusArchived') : app.status === 'inactive' ? t('statusInactive') : app.status}
                              </span>
                            </div>
                            <p className="text-gray-400 text-sm truncate">{app.description}</p>
                          </div>

                          {/* Quick stats */}
                          <div className="flex items-center gap-6 shrink-0">
                            <div className="text-center">
                              <div className="text-xl font-bold text-orange-500">{app._count.feedbacks}</div>
                              <div className="text-xs text-gray-300">{t('feedbacks')}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-amber-500 text-sm tracking-wider">{renderStars(app.avgRating)}</div>
                              <div className="text-xs text-gray-300">{app.avgRating > 0 ? app.avgRating.toFixed(1) : '-'}</div>
                            </div>
                          </div>
                        </div>

                        {/* Latest feedback preview */}
                        {app.latestFeedback && (
                          <div className="bg-gray-50/80 rounded-lg p-4 mb-4 border border-gray-100">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-xs font-medium text-gray-500">{t('latestFeedback')}</span>
                              <span className="text-xs text-gray-300">·</span>
                              <span className="text-xs text-gray-400">{app.latestFeedback.agentName}</span>
                              <span className="px-1.5 py-0.5 text-[10px] bg-white border border-gray-200 rounded text-gray-400">
                                {agentTypeLabels[app.latestFeedback.agentType as keyof typeof agentTypeLabels] ?? app.latestFeedback.agentType}
                              </span>
                              <span className="text-amber-400 text-xs ml-auto">
                                {'★'.repeat(app.latestFeedback.overallRating)}
                              </span>
                            </div>
                            <p className="text-gray-500 text-sm line-clamp-2">{app.latestFeedback.summary}</p>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/developer/apps/${app.id}/feedbacks`}
                            className="px-4 py-2 border border-orange-200 text-orange-500 text-xs tracking-wide rounded-lg
                                       hover:bg-orange-50 transition-colors"
                          >
                            {t('viewFeedbacks')}
                          </Link>
                          <Link
                            href={`/developer/apps/${app.id}/settings`}
                            className="px-4 py-2 border border-gray-200 text-gray-500 text-xs tracking-wide rounded-lg
                                       hover:bg-gray-50 transition-colors"
                          >
                            {t('settings')}
                          </Link>
                          <Link
                            href={`/app-pa/${app.id}`}
                            className="px-4 py-2 text-gray-400 text-xs tracking-wide rounded-lg
                                       hover:text-orange-500 transition-colors ml-auto"
                          >
                            {t('viewDetails')}
                          </Link>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* My Practices Section */}
              <div className="mt-16">
                <div className="mb-8 flex flex-wrap justify-between items-center gap-4">
                  <h2 className="text-2xl font-bold text-gray-800 font-heading">{t('myPractices')}</h2>
                  <Button asChild size="sm">
                    <Link href="/practices/new">{t('publishPractice')}</Link>
                  </Button>
                </div>

                {practices.length === 0 ? (
                  <Card className="p-16 text-center">
                    <div className="text-5xl mb-4">📝</div>
                    <p className="text-gray-500 text-lg mb-2">{t('emptyPracticesTitle')}</p>
                    <p className="text-gray-300 text-sm mb-6">{t('emptyPracticesDesc')}</p>
                    <Button asChild>
                      <Link href="/practices/new">{t('publishFirstPractice')}</Link>
                    </Button>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {practices.map(p => (
                      <Card key={p.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                        <div className="p-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-2">
                                <Link
                                  href={`/practices/${p.id}`}
                                  className="text-lg font-bold text-gray-800 hover:text-orange-500 transition-colors truncate"
                                >
                                  {p.title}
                                </Link>
                                <span className={`px-2 py-0.5 text-xs rounded-full ${
                                  p.category === 'practice'
                                    ? 'bg-blue-50 text-blue-600 border border-blue-200'
                                    : p.category === 'showcase'
                                    ? 'bg-purple-50 text-purple-600 border border-purple-200'
                                    : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                }`}>
                                  {p.category === 'practice' ? t('catPractice') : p.category === 'showcase' ? t('catShowcase') : t('catTip')}
                                </span>
                                {p.status === 'draft' && (
                                  <span className="px-2 py-0.5 text-xs rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                                    {tp('draft')}
                                  </span>
                                )}
                              </div>
                              <p className="text-gray-400 text-sm line-clamp-2">{p.summary}</p>
                              {Array.isArray(p.tags) && p.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {p.tags.map((tag: string) => (
                                    <span key={tag} className="px-2 py-0.5 bg-gray-50 border border-gray-200 rounded text-xs text-gray-500">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-6 shrink-0">
                              <div className="text-center">
                                <div className="text-xl font-bold text-orange-500">{p.viewCount}</div>
                                <div className="text-xs text-gray-300">{t('views')}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-xl font-bold text-rose-400">{p.likeCount}</div>
                                <div className="text-xs text-gray-300">{t('likes')}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                    <div className="text-center pt-4">
                      <Link href="/practices" className="text-sm text-orange-500 hover:text-orange-600 transition-colors">
                        {t('browseAllPractices')}
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
