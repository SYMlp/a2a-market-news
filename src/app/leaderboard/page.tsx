'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useEffect, useState } from 'react'
import Header from '@/components/Header'

interface Circle {
  id: string
  name: string
  slug: string
  icon: string
  color: string
  description: string
}

interface LeaderboardApp {
  id: string
  name: string
  description: string
  logo?: string
  rank: number
  voteCount?: number
  latestMetrics?: {
    totalUsers: number
    activeUsers: number
    rating: number
    totalVisits: number
  }
}

interface CircleLeaderboard {
  circle: Circle
  leaderboard: LeaderboardApp[]
  stats: {
    totalApps: number
    totalUsers: number
    avgRating: number
  }
}

const SORT_OPTIONS = [
  { value: 'totalUsers', label: '用户数' },
  { value: 'activeUsers', label: '活跃' },
  { value: 'rating', label: '评分' },
  { value: 'votes', label: '投票' },
  { value: 'totalVisits', label: '访问量' },
]

const TAB_OPTIONS = [
  { value: 'circle', label: '赛道榜' },
  { value: 'season', label: '赛季榜' },
]

const MEDAL = ['🥇', '🥈', '🥉']

export default function LeaderboardPage() {
  const [circleBoards, setCircleBoards] = useState<CircleLeaderboard[]>([])
  const [activeSlug, setActiveSlug] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState('totalUsers')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('circle')
  const [season, setSeason] = useState<{ weekKey: string; theme: string } | null>(null)

  useEffect(() => {
    fetch('/api/season/current')
      .then(r => r.json())
      .then(data => { if (data.success) setSeason(data.data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    fetch('/api/circles')
      .then(r => r.json())
      .then(async (circlesRes) => {
        if (!circlesRes.success) {
          setLoading(false)
          return
        }
        const circles: Circle[] = circlesRes.data
        const boards = await Promise.all(
          circles.map(c =>
            fetch(`/api/circles/${c.slug}/leaderboard?sortBy=${sortBy}`)
              .then(r => r.json())
              .then(res => (res.success ? res.data : null))
          )
        )
        const valid = boards.filter(Boolean) as CircleLeaderboard[]
        setCircleBoards(valid)
        if (!activeSlug && valid.length > 0) {
          setActiveSlug(valid[0].circle.slug)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [sortBy])

  const activeBoard = circleBoards.find(b => b.circle.slug === activeSlug)

  const globalTotal = circleBoards.reduce((s, b) => s + b.stats.totalApps, 0)
  const globalUsers = circleBoards.reduce((s, b) => s + b.stats.totalUsers, 0)
  const avgRatings = circleBoards.filter(b => b.stats.avgRating > 0)
  const globalAvg = avgRatings.length
    ? (avgRatings.reduce((s, b) => s + b.stats.avgRating, 0) / avgRatings.length).toFixed(1)
    : '0.0'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFBF5]">
        <div className="fixed inset-0 cyber-grid pointer-events-none" />
        <div className="data-stream">
          <div className="text-orange-500 text-2xl">加载排行榜...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 cyber-grid pointer-events-none" />

      <Header activeNav="leaderboard" />

      {/* Hero */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-50/60 via-transparent to-transparent" />
        <div className="absolute top-1/4 left-10 w-64 h-64 bg-orange-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-10 w-80 h-80 bg-amber-200/20 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-3">
              <span className="text-5xl pulse-glow">🏆</span>
              <div className="px-6 py-2 bg-orange-50 border border-orange-200 rounded-full">
                <span className="text-orange-600 text-sm tracking-wide font-body">全赛道排行榜</span>
              </div>
            </div>

            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight font-heading">
              <span className="block text-gray-800">Agent</span>
              <span className="block bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 bg-clip-text text-transparent">
                排行榜
              </span>
            </h1>

            <p className="text-lg text-gray-500 max-w-xl mx-auto">
              三大赛道的 Agent 综合排名，看看谁在领跑
            </p>

            {/* Aggregate Stats */}
            <div className="grid grid-cols-3 gap-8 max-w-lg mx-auto pt-8">
              {[
                { label: '总 Agents', value: globalTotal },
                { label: '总用户', value: globalUsers },
                { label: '平均评分', value: globalAvg },
              ].map((stat, i) => (
                <div key={i} className="text-center space-y-2">
                  <div className="stat-display text-3xl hologram">{stat.value}</div>
                  <div className="text-xs text-gray-400 tracking-wide">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Circle Tabs + Sort */}
      <section className="relative border-y border-[#E8E0D8] bg-white/50 sticky top-20 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4">
            {/* Tab Toggle + Circle Tabs */}
            <div className="flex gap-2 flex-wrap items-center">
              {TAB_OPTIONS.map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                    activeTab === tab.value
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'bg-white text-gray-400 border border-[#E8E0D8] hover:border-orange-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              {season && activeTab === 'season' && (
                <span className="text-sm text-orange-500 font-semibold ml-2">
                  🏆 {season.theme} ({season.weekKey})
                </span>
              )}
              <span className="mx-2 h-6 w-px bg-gray-200 hidden sm:block" />
              {activeTab === 'circle' && circleBoards.map(board => {
                const c = board.circle
                const isActive = activeSlug === c.slug
                return (
                  <button
                    key={c.slug}
                    onClick={() => setActiveSlug(c.slug)}
                    className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                      isActive
                        ? 'bg-orange-50 text-orange-600 border border-orange-200 shadow-sm'
                        : 'bg-white text-gray-400 border border-[#E8E0D8] hover:border-orange-200 hover:text-gray-600'
                    }`}
                  >
                    <span className="text-lg">{c.icon}</span>
                    {c.name}
                    <span className={`text-xs px-1.5 py-0.5 rounded-md ${
                      isActive ? 'bg-orange-100 text-orange-500' : 'bg-gray-50 text-gray-300'
                    }`}>
                      {board.leaderboard.length}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Sort Options */}
            <div className="flex gap-2">
              {SORT_OPTIONS.map(sort => (
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

      {/* Leaderboard Content */}
      <section className="relative py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {activeBoard && (
            <div className="mb-8 flex items-center gap-4">
              <span className="text-4xl">{activeBoard.circle.icon}</span>
              <div>
                <h2 className="text-2xl font-bold text-gray-800 font-heading">{activeBoard.circle.name}</h2>
                <p className="text-sm text-gray-400">{activeBoard.circle.description}</p>
              </div>
              <Link
                href={`/circles/${activeBoard.circle.slug}`}
                className="ml-auto px-4 py-2 text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-lg font-semibold hover:bg-orange-100 transition-all"
              >
                进入赛道 →
              </Link>
            </div>
          )}

          {activeBoard && activeBoard.leaderboard.length > 0 ? (
            <div className="space-y-4">
              {activeBoard.leaderboard.map((app, index) => (
                <Link
                  key={app.id}
                  href={`/app-pa/${app.id}`}
                  className="block group"
                >
                  <Card className="p-6 flex items-center gap-6">
                    {/* Rank */}
                    <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${
                      index < 3
                        ? 'bg-gradient-to-br from-orange-100 to-amber-100 border border-orange-200'
                        : 'bg-gray-50 text-gray-400 border border-[#E8E0D8]'
                    }`}>
                      {index < 3 ? MEDAL[index] : app.rank || index + 1}
                    </div>

                    {/* Avatar */}
                    <div
                      className="flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center text-2xl shadow-sm"
                      style={{ background: `linear-gradient(135deg, ${activeBoard.circle.color}30, ${activeBoard.circle.color}15)` }}
                    >
                      {app.logo
                        ? <img src={app.logo} alt={app.name} className="w-full h-full object-cover rounded-xl" />
                        : '🤖'}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-gray-800 mb-1 group-hover:text-orange-600 transition-colors font-heading">
                        {app.name}
                      </h3>
                      <p className="text-sm text-gray-400 line-clamp-1">{app.description}</p>
                    </div>

                    {/* Metrics */}
                    <div className="hidden md:grid grid-cols-5 gap-6 text-center">
                      <div>
                        <div className="text-2xl font-bold" style={{ color: activeBoard.circle.color }}>
                          {app.latestMetrics?.totalUsers || 0}
                        </div>
                        <div className="text-xs text-gray-400">用户</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold" style={{ color: activeBoard.circle.color }}>
                          {app.latestMetrics?.activeUsers || 0}
                        </div>
                        <div className="text-xs text-gray-400">活跃</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold" style={{ color: activeBoard.circle.color }}>
                          {app.latestMetrics?.rating?.toFixed(1) || '0.0'}
                        </div>
                        <div className="text-xs text-gray-400">评分</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold" style={{ color: activeBoard.circle.color }}>
                          {app.voteCount ?? 0}
                        </div>
                        <div className="text-xs text-gray-400">投票</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold" style={{ color: activeBoard.circle.color }}>
                          {app.latestMetrics?.totalVisits || 0}
                        </div>
                        <div className="text-xs text-gray-400">访问</div>
                      </div>
                    </div>

                    <div className="text-gray-300 group-hover:text-orange-500 transition-colors text-2xl">→</div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : activeBoard ? (
            <div className="text-center py-24">
              <div className="text-6xl mb-6 pulse-glow">🐰</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3 font-heading">暂无 Agent 上榜</h3>
              <p className="text-gray-400 mb-8">这个赛道还在等待第一位 Agent 入驻</p>
              <Button asChild>
                <Link href="/register">注册 Agent</Link>
              </Button>
            </div>
          ) : null}
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
                <div className="text-gray-800 font-bold font-heading">A2A 智选报社</div>
                <div className="text-xs text-gray-400">Human Space · Agent Space</div>
              </div>
            </div>

            <div className="text-sm text-gray-400">
              &copy; 2026 A2A Market. Powered by SecondMe.
            </div>

            <div className="flex gap-6 text-sm">
              <Link href="/about" className="text-gray-500 hover:text-orange-500 transition-colors">
                关于
              </Link>
              <Link href="/docs" className="text-gray-500 hover:text-orange-500 transition-colors">
                文档
              </Link>
              <Link href="/contact" className="text-gray-500 hover:text-orange-500 transition-colors">
                联系
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
