'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Header from '@/components/Header'

interface App {
  id: string
  name: string
  description: string
  logo?: string
  circle: {
    name: string
    icon: string
    color: string
  }
  metrics: Array<{
    totalUsers: number
    activeUsers: number
    rating: number
    totalVisits: number
  }>
}

interface Circle {
  id: string
  name: string
  slug: string
  icon: string
  color: string
  description: string
}

export default function CirclePage() {
  const params = useParams()
  const slug = params.slug as string

  const [circle, setCircle] = useState<Circle | null>(null)
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [sortBy, setSortBy] = useState('totalUsers')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/circles/${slug}/leaderboard?sortBy=${sortBy}`).then(r => r.json()),
    ]).then(([leaderboardData]) => {
      if (leaderboardData.success) {
        setCircle(leaderboardData.data.circle)
        setLeaderboard(leaderboardData.data.leaderboard)
      }
      setLoading(false)
    })
  }, [slug, sortBy])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFBF5]">
        <div className="data-stream">
          <div className="text-orange-500 text-2xl">加载赛道数据...</div>
        </div>
      </div>
    )
  }

  if (!circle) {
    return <div className="min-h-screen flex items-center justify-center text-gray-800 bg-[#FFFBF5]">未找到赛道</div>
  }

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 cyber-grid pointer-events-none" />

      <Header activeNav="circles" />

      {/* Circle Hero */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-50/50 via-transparent to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-orange-500 transition-colors mb-8 text-sm">
            <span>←</span> 返回首页
          </Link>

          <div className="flex items-center gap-8 mb-8">
            <div className="text-7xl pulse-glow">
              {circle.icon}
            </div>
            <div>
              <h1 className="text-5xl font-extrabold text-gray-800 mb-3 font-heading">{circle.name}</h1>
              <p className="text-lg text-gray-500">{circle.description}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Sort Controls */}
      <section className="relative py-6 border-y border-[#E8E0D8] bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold text-gray-800 font-heading">排行榜</h2>
              <Link
                href={`/circles/${slug}/discussion`}
                className="px-4 py-2 bg-orange-50 text-orange-600 border border-orange-200 text-sm font-semibold rounded-lg hover:bg-orange-100 transition-all"
              >
                💬 进入讨论区
              </Link>
            </div>
            <div className="flex gap-2">
              {[
                { value: 'totalUsers', label: '用户数' },
                { value: 'activeUsers', label: '活跃' },
                { value: 'rating', label: '评分' },
                { value: 'totalVisits', label: '访问量' },
              ].map(sort => (
                <button
                  key={sort.value}
                  onClick={() => setSortBy(sort.value)}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                    sortBy === sort.value
                      ? 'bg-orange-50 text-orange-600 border border-orange-200'
                      : 'bg-white text-gray-400 border border-[#E8E0D8] hover:border-orange-200'
                  }`}
                >
                  {sort.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Leaderboard */}
      <section className="relative py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-4">
            {leaderboard.map((app, index) => (
              <Link
                key={app.id}
                href={`/app-pa/${app.id}`}
                className="block group"
              >
                <div className="cyber-card p-6 flex items-center gap-6">
                  <div className={`rank-badge ${index < 3 ? `rank-${index + 1}` : 'bg-gray-100 text-gray-400'}`}>
                    {app.rank}
                  </div>

                  <div className="w-16 h-16 bg-gradient-to-br from-orange-300 to-amber-400 rounded-xl flex items-center justify-center text-2xl shadow-sm">
                    {app.logo ? <img src={app.logo} alt={app.name} className="w-full h-full object-cover rounded-xl" /> : '🤖'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-gray-800 mb-1 group-hover:text-orange-600 transition-colors font-heading">
                      {app.name}
                    </h3>
                    <p className="text-sm text-gray-400 line-clamp-1">{app.description}</p>
                  </div>

                  <div className="grid grid-cols-4 gap-8 text-center">
                    <div>
                      <div className="text-2xl font-bold" style={{ color: circle.color }}>
                        {app.latestMetrics?.totalUsers || 0}
                      </div>
                      <div className="text-xs text-gray-400">用户</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold" style={{ color: circle.color }}>
                        {app.latestMetrics?.activeUsers || 0}
                      </div>
                      <div className="text-xs text-gray-400">活跃</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold" style={{ color: circle.color }}>
                        {app.latestMetrics?.rating?.toFixed(1) || '0.0'}
                      </div>
                      <div className="text-xs text-gray-400">评分</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold" style={{ color: circle.color }}>
                        {app.latestMetrics?.totalVisits || 0}
                      </div>
                      <div className="text-xs text-gray-400">访问</div>
                    </div>
                  </div>

                  <div className="text-gray-300 group-hover:text-orange-500 transition-colors text-2xl">→</div>
                </div>
              </Link>
            ))}
          </div>

          {leaderboard.length === 0 && (
            <div className="text-center py-20">
              <div className="text-gray-400 text-lg">暂无 Agent</div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
