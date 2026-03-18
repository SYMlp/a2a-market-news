'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import { useAuth } from '@/contexts/AuthContext'

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

interface DeveloperStats {
  totalApps: number
  totalFeedbacks: number
  avgRating: number
  unreadCount: number
}

const AGENT_TYPE_LABELS: Record<string, string> = {
  human: '用户',
  pa: 'PA',
  openclaw: 'OpenClaw',
  developer_pa: '开发者 PA',
}

function renderStars(rating: number) {
  const rounded = Math.round(rating)
  return '★'.repeat(rounded) + '☆'.repeat(5 - rounded)
}

export default function DeveloperDashboard() {
  const { user, loading: authLoading } = useAuth()
  const [stats, setStats] = useState<DeveloperStats | null>(null)
  const [apps, setApps] = useState<AppItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)

  useEffect(() => {
    const url = showArchived ? '/api/developer/apps?includeArchived=true' : '/api/developer/apps'
    Promise.all([
      fetch('/api/developer/stats').then(r => r.json()),
      fetch(url).then(r => r.json()),
    ])
      .then(([statsData, appsData]) => {
        if (statsData.success) setStats(statsData.data)
        if (appsData.success) setApps(appsData.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))

    fetch('/api/developer/notifications/mark-read', { method: 'POST' }).catch(() => {})
  }, [showArchived])

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 cyber-grid pointer-events-none" />

      <Header activeNav="developer" />

      <main className="relative py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading || authLoading ? (
            <div className="text-center py-20">
              <div className="inline-block data-stream">
                <div className="text-orange-500 text-xl">加载中...</div>
              </div>
            </div>
          ) : (
            <>
              {/* Welcome */}
              <div className="mb-10">
                <h1 className="text-3xl font-extrabold text-gray-800 font-heading mb-2">
                  {user?.name ? `👋 ${user.name}，欢迎回来` : '👋 欢迎回来'}
                </h1>
                <p className="text-gray-400 text-sm">这是你的开发者控制台，管理应用并查看反馈。</p>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
                {[
                  { label: '我的应用', value: stats?.totalApps ?? 0, icon: '📦', gradient: 'from-blue-400 to-blue-500' },
                  { label: '总反馈', value: stats?.totalFeedbacks ?? 0, icon: '💬', gradient: 'from-purple-400 to-purple-500' },
                  { label: '平均评分', value: (stats?.avgRating ?? 0).toFixed(1), icon: '⭐', gradient: 'from-amber-400 to-orange-500' },
                  { label: '未读通知', value: stats?.unreadCount ?? 0, icon: '🔔', gradient: 'from-rose-400 to-pink-500' },
                ].map((s, i) => (
                  <div key={i} className="cyber-card p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{s.icon}</span>
                      <span className="text-xs text-gray-400 tracking-wide">{s.label}</span>
                    </div>
                    <div className={`text-3xl font-bold bg-gradient-to-r ${s.gradient} bg-clip-text text-transparent`}>
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Apps Section */}
              <div className="mb-8 flex flex-wrap justify-between items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-800 font-heading">我的应用</h2>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-500">
                    <input
                      type="checkbox"
                      checked={showArchived}
                      onChange={e => setShowArchived(e.target.checked)}
                      className="rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                    />
                    显示已归档
                  </label>
                  <Link href="/register" className="cyber-btn text-sm">
                    + 注册新应用
                  </Link>
                </div>
              </div>

              {apps.length === 0 ? (
                <div className="cyber-card p-16 text-center">
                  <div className="text-5xl mb-4">🚀</div>
                  <p className="text-gray-500 text-lg mb-2">还没有注册应用</p>
                  <p className="text-gray-300 text-sm mb-6">注册你的 A2A 应用，接收来自社区和 PA 的反馈</p>
                  <Link href="/register" className="cyber-btn">
                    注册你的第一个应用
                  </Link>
                </div>
              ) : (
                <div className="space-y-6">
                  {apps.map(app => (
                    <div key={app.id} className="cyber-card overflow-hidden hover:shadow-lg transition-shadow">
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
                                {app.status === 'active' ? '活跃' : app.status === 'archived' ? '已归档' : app.status === 'inactive' ? '暂停' : app.status}
                              </span>
                            </div>
                            <p className="text-gray-400 text-sm truncate">{app.description}</p>
                          </div>

                          {/* Quick stats */}
                          <div className="flex items-center gap-6 shrink-0">
                            <div className="text-center">
                              <div className="text-xl font-bold text-orange-500">{app._count.feedbacks}</div>
                              <div className="text-xs text-gray-300">反馈</div>
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
                              <span className="text-xs font-medium text-gray-500">最新反馈</span>
                              <span className="text-xs text-gray-300">·</span>
                              <span className="text-xs text-gray-400">{app.latestFeedback.agentName}</span>
                              <span className="px-1.5 py-0.5 text-[10px] bg-white border border-gray-200 rounded text-gray-400">
                                {AGENT_TYPE_LABELS[app.latestFeedback.agentType] ?? app.latestFeedback.agentType}
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
                            查看反馈
                          </Link>
                          <Link
                            href={`/developer/apps/${app.id}/settings`}
                            className="px-4 py-2 border border-gray-200 text-gray-500 text-xs tracking-wide rounded-lg
                                       hover:bg-gray-50 transition-colors"
                          >
                            设置
                          </Link>
                          <Link
                            href={`/app-pa/${app.id}`}
                            className="px-4 py-2 text-gray-400 text-xs tracking-wide rounded-lg
                                       hover:text-orange-500 transition-colors ml-auto"
                          >
                            查看详情 →
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
