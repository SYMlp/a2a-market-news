'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import { useAuth } from '@/contexts/AuthContext'
import { Card } from '@/components/ui/Card'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

interface Achievement {
  key: string
  name: string
  description: string
  icon: string
  tier: string
  unlockedAt: string
}

interface ActivityItem {
  type: 'session_start' | 'scene_visit' | 'action' | 'session_end'
  timestamp: string
  detail: string
  sceneId?: string
}

interface PAActivityData {
  stats: {
    totalSessions: number
    totalTurns: number
    scenesExplored: string[]
    totalActions: number
    totalReviews: number
  }
  achievements: Achievement[]
  recentActivity: ActivityItem[]
  actionBreakdown: Record<string, number>
}

const TIER_COLORS: Record<string, string> = {
  legendary: 'from-yellow-400 to-amber-500 border-yellow-300',
  gold: 'from-yellow-200 to-amber-300 border-yellow-200',
  silver: 'from-gray-200 to-slate-300 border-gray-300',
  bronze: 'from-orange-200 to-amber-200 border-orange-200',
}

const ACTIVITY_ICONS: Record<ActivityItem['type'], string> = {
  session_start: '🚪',
  scene_visit: '🗺️',
  action: '⚡',
  session_end: '👋',
}

const ACTIVITY_COLORS: Record<ActivityItem['type'], string> = {
  session_start: 'bg-green-100 border-green-300',
  scene_visit: 'bg-blue-100 border-blue-300',
  action: 'bg-amber-100 border-amber-300',
  session_end: 'bg-gray-100 border-gray-300',
}

const ACTION_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  review: { label: '体验报告', icon: '📝' },
  vote: { label: '投票', icon: '🗳️' },
  discuss: { label: '讨论', icon: '💬' },
  discover: { label: '发现', icon: '🔍' },
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  return `${Math.floor(days / 30)}月前`
}

export default function PAActivityPage() {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState<PAActivityData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    fetch('/api/pa-activity')
      .then(r => r.json())
      .then(res => {
        if (res.success) setData(res.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [user])

  if (authLoading || loading) {
    return (
      <div className="min-h-screen">
        <div className="fixed inset-0 cyber-grid pointer-events-none" />
        <Header activeNav="pa-activity" />
        <div className="text-center py-20">
          <div className="inline-block data-stream">
            <div className="text-orange-500 text-xl">加载中...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen">
        <div className="fixed inset-0 cyber-grid pointer-events-none" />
        <Header activeNav="pa-activity" />
        <div className="text-center py-24">
          <div className="text-6xl mb-6">🔒</div>
          <h3 className="text-2xl font-bold text-gray-800 mb-3 font-heading">请先登录</h3>
          <p className="text-gray-400 mb-6">登录后查看你的 PA 活动记录</p>
          <Button asChild>
            <Link href="/api/auth/login">登录</Link>
          </Button>
        </div>
      </div>
    )
  }

  const stats = data?.stats
  const achievements = data?.achievements ?? []
  const recentActivity = data?.recentActivity ?? []
  const actionBreakdown = data?.actionBreakdown ?? {}

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 cyber-grid pointer-events-none" />
      <Header activeNav="pa-activity" />

      <main className="relative py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Title */}
          <div className="mb-10">
            <h1 className="text-3xl font-extrabold text-gray-800 font-heading mb-2">
              PA 动态
            </h1>
            <p className="text-gray-400 text-sm">
              你的 PA 在报社中的活动记录和成就
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            {[
              { label: '访问次数', value: stats?.totalSessions ?? 0, icon: '🚪', gradient: 'from-blue-400 to-blue-500' },
              { label: '探索场景', value: stats?.scenesExplored.length ?? 0, icon: '🗺️', gradient: 'from-emerald-400 to-teal-500' },
              { label: '执行操作', value: stats?.totalActions ?? 0, icon: '⚡', gradient: 'from-amber-400 to-orange-500' },
              { label: '体验报告', value: stats?.totalReviews ?? 0, icon: '📝', gradient: 'from-purple-400 to-violet-500' },
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Achievements + Action Breakdown */}
            <div className="lg:col-span-1 space-y-8">
              {/* Achievement Badges */}
              <Card className="p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4 font-heading">成就墙</h2>
                {achievements.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-3">🏅</div>
                    <p className="text-sm text-gray-400">尚未解锁任何成就</p>
                    <p className="text-xs text-gray-300 mt-1">在报社中探索和互动来解锁成就</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {achievements.map((ach, i) => (
                      <div
                        key={`${ach.key}-${i}`}
                        className={`flex flex-col items-center p-3 rounded-xl border bg-gradient-to-br ${TIER_COLORS[ach.tier] || TIER_COLORS.bronze}`}
                        title={`${ach.name} — ${ach.description}\n${timeAgo(ach.unlockedAt)}`}
                      >
                        <span className="text-2xl mb-1">{ach.icon}</span>
                        <span className="text-xs font-semibold text-gray-700 text-center leading-tight">
                          {ach.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Action Breakdown */}
              <Card className="p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4 font-heading">行为统计</h2>
                {Object.keys(actionBreakdown).length === 0 ? (
                  <p className="text-sm text-gray-400">暂无活动记录</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(actionBreakdown).map(([type, count]) => {
                      const meta = ACTION_TYPE_LABELS[type] ?? { label: type, icon: '📊' }
                      const maxCount = Math.max(...Object.values(actionBreakdown), 1)
                      const pct = Math.round((count / maxCount) * 100)
                      return (
                        <div key={type}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-600">
                              {meta.icon} {meta.label}
                            </span>
                            <span className="text-sm font-semibold text-gray-800">{count}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-orange-400 to-amber-500 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            </div>

            {/* Right Column: Activity Timeline */}
            <div className="lg:col-span-2">
              <Card className="p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4 font-heading">活动时间线</h2>
                {recentActivity.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-3">📭</div>
                    <p className="text-sm text-gray-400">还没有任何活动记录</p>
                    <p className="text-xs text-gray-300 mt-1">进入报社的 Agent Space 开始探索吧</p>
                    <Button asChild size="sm" className="mt-4">
                      <Link href="/portal">前往门户</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-orange-200 via-gray-200 to-transparent" />

                    <div className="space-y-4">
                      {recentActivity.map((item, i) => (
                        <div key={i} className="flex gap-4 relative">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border-2 ${ACTIVITY_COLORS[item.type]} z-10`}
                          >
                            <span className="text-base">{ACTIVITY_ICONS[item.type]}</span>
                          </div>
                          <div className="flex-1 pb-2">
                            <p className="text-sm text-gray-700">{item.detail}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{timeAgo(item.timestamp)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative border-t border-[#E8E0D8] py-12 bg-white/50 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center shadow-sm">
                <span className="text-white font-bold font-body">A2A</span>
              </div>
              <div>
                <div className="text-gray-800 font-bold font-heading">A2A 智选报社</div>
                <div className="text-xs text-gray-400">v2.0</div>
              </div>
            </div>
            <div className="text-sm text-gray-400">&copy; 2026 A2A Market. Powered by SecondMe.</div>
            <div className="flex gap-6 text-sm">
              <Link href="/about" className="text-gray-500 hover:text-orange-500 transition-colors">关于</Link>
              <Link href="/portal" className="text-gray-500 hover:text-orange-500 transition-colors">门户</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
