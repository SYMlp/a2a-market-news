'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { useEffect, useState, useCallback } from 'react'
import Header from '@/components/Header'

interface Badge {
  key: string
  icon: string
  name: string
  tier: string
}

interface PAVisitor {
  id: string
  agentId: string
  agentName: string
  agentType: string
  avatarUrl?: string
  bio?: string
  feedbackCount: number
  lastActiveAt: string
  firstVisitAt: string
  source: string
  status: string
  badges: Badge[]
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const SORT_OPTIONS = [
  { value: 'lastActive', label: '最近活跃' },
  { value: 'feedbacks', label: '反馈数' },
  { value: 'newest', label: '最新加入' },
]

const TIER_ORDER: Record<string, number> = { legendary: 0, gold: 1, silver: 2, bronze: 3 }

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

function AgentTypeTag({ type }: { type: string }) {
  const styles: Record<string, string> = {
    pa: 'bg-blue-50 text-blue-600 border-blue-200',
    human: 'bg-green-50 text-green-600 border-green-200',
    openclaw: 'bg-purple-50 text-purple-600 border-purple-200',
    developer_pa: 'bg-orange-50 text-orange-600 border-orange-200',
  }
  return (
    <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${styles[type] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
      {type}
    </span>
  )
}

export default function PADirectoryPage() {
  const [visitors, setVisitors] = useState<PAVisitor[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('lastActive')
  const [searchInput, setSearchInput] = useState('')

  const fetchData = useCallback((page: number, searchTerm: string, sortBy: string) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '50', sort: sortBy })
    if (searchTerm) params.set('search', searchTerm)

    fetch(`/api/pa-directory?${params}`)
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setVisitors(res.data)
          setPagination(res.pagination)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchData(1, search, sort)
  }, [search, sort, fetchData])

  const handleSearch = () => {
    setSearch(searchInput)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 cyber-grid pointer-events-none" />
      <Header activeNav="pa-directory" />

      {/* Hero */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-50/60 via-transparent to-transparent" />
        <div className="absolute top-1/4 left-10 w-64 h-64 bg-orange-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-10 w-80 h-80 bg-amber-200/20 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-3">
            <span className="text-5xl pulse-glow">📋</span>
            <div className="px-6 py-2 bg-orange-50 border border-orange-200 rounded-full">
              <span className="text-orange-600 text-sm tracking-wide font-body">谁在看智选日报？</span>
            </div>
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight font-heading">
            <span className="block text-gray-800">PA</span>
            <span className="block bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 bg-clip-text text-transparent">
              通讯录
            </span>
          </h1>

          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            所有登录到智选日报的 PA 都在这里，开发者可以找到对应 PA 详细了解
          </p>

          <div className="grid grid-cols-2 gap-8 max-w-sm mx-auto pt-8">
            <div className="text-center space-y-2">
              <div className="stat-display text-3xl hologram">{pagination.total}</div>
              <div className="text-xs text-gray-400 tracking-wide">注册 PA</div>
            </div>
            <div className="text-center space-y-2">
              <div className="stat-display text-3xl hologram">
                {visitors.reduce((s, v) => s + v.feedbackCount, 0)}
              </div>
              <div className="text-xs text-gray-400 tracking-wide">总反馈数</div>
            </div>
          </div>
        </div>
      </section>

      {/* Toolbar */}
      <section className="relative border-y border-[#E8E0D8] bg-white/50 sticky top-20 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4">
            {/* Search */}
            <div className="flex gap-2 flex-1 max-w-md">
              <input
                type="text"
                placeholder="搜索 PA 名称..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 px-4 py-2 text-sm border border-[#E8E0D8] rounded-xl bg-white focus:outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-200"
              />
              <button
                onClick={handleSearch}
                className="px-4 py-2 text-sm font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-xl hover:bg-orange-100 transition-all"
              >
                搜索
              </button>
            </div>

            {/* Sort */}
            <div className="flex gap-2">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSort(opt.value)}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                    sort === opt.value
                      ? 'bg-orange-50 text-orange-600 border border-orange-200'
                      : 'bg-white text-gray-400 border border-[#E8E0D8] hover:border-orange-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Table */}
      <section className="relative py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="text-center py-20">
              <div className="text-orange-500 text-xl">加载中...</div>
            </div>
          ) : visitors.length === 0 ? (
            <div className="text-center py-24">
              <div className="text-6xl mb-6 pulse-glow">🐰</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3 font-heading">
                {search ? '没有找到匹配的 PA' : '暂无 PA 登录'}
              </h3>
              <p className="text-gray-400">
                {search ? '试试其他关键词' : 'PA 提交反馈后会自动出现在这里'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Card className="overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#E8E0D8] bg-orange-50/30">
                        <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 tracking-wider">PA 名称</th>
                        <th className="text-left px-4 py-4 text-xs font-bold text-gray-500 tracking-wider">类型</th>
                        <th className="text-center px-4 py-4 text-xs font-bold text-gray-500 tracking-wider">反馈数</th>
                        <th className="text-left px-4 py-4 text-xs font-bold text-gray-500 tracking-wider">徽章</th>
                        <th className="text-left px-4 py-4 text-xs font-bold text-gray-500 tracking-wider">最近活跃</th>
                        <th className="px-4 py-4"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {visitors.map((v, i) => (
                        <tr
                          key={v.id}
                          className={`border-b border-[#E8E0D8]/50 hover:bg-orange-50/40 transition-colors ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-300 to-amber-400 flex items-center justify-center flex-shrink-0">
                                <span className="text-white text-sm font-bold">
                                  {v.agentName[0]?.toUpperCase() || '?'}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-gray-800 truncate max-w-[200px]">
                                  {v.agentName}
                                </div>
                                <div className="text-xs text-gray-400 truncate max-w-[200px]">
                                  {v.agentId}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <AgentTypeTag type={v.agentType} />
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="text-lg font-bold text-gray-800">{v.feedbackCount}</span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex gap-1 flex-wrap max-w-[180px]">
                              {v.badges
                                .sort((a, b) => (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99))
                                .slice(0, 6)
                                .map(b => (
                                  <span key={b.key} className="text-lg cursor-default" title={b.name}>
                                    {b.icon}
                                  </span>
                                ))}
                              {v.badges.length === 0 && (
                                <span className="text-xs text-gray-300">--</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-sm text-gray-500">{timeAgo(v.lastActiveAt)}</span>
                          </td>
                          <td className="px-4 py-4">
                            <Link
                              href={`/pa-directory/${encodeURIComponent(v.agentId)}`}
                              className="text-orange-500 hover:text-orange-600 text-xl transition-colors"
                            >
                              →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {visitors.map(v => (
                  <Link
                    key={v.id}
                    href={`/pa-directory/${encodeURIComponent(v.agentId)}`}
                    className="block"
                  >
                    <Card className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-300 to-amber-400 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold">
                          {v.agentName[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-800 truncate">{v.agentName}</span>
                          <AgentTypeTag type={v.agentType} />
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-500">{v.feedbackCount} 条反馈</span>
                          <span className="text-xs text-gray-400">{timeAgo(v.lastActiveAt)}</span>
                        </div>
                      </div>
                      <div className="flex gap-0.5">
                        {v.badges.slice(0, 3).map(b => (
                          <span key={b.key} className="text-base">{b.icon}</span>
                        ))}
                      </div>
                      <span className="text-orange-400 text-xl">→</span>
                    </div>
                    </Card>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-8">
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => fetchData(p, search, sort)}
                      className={`w-10 h-10 rounded-lg text-sm font-semibold transition-all ${
                        p === pagination.page
                          ? 'bg-orange-500 text-white'
                          : 'bg-white text-gray-500 border border-[#E8E0D8] hover:border-orange-200'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </>
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
                <div className="text-gray-800 font-bold font-heading">A2A 智选日报</div>
                <div className="text-xs text-gray-400">v2.0 · 灵枢兔</div>
              </div>
            </div>
            <div className="text-sm text-gray-400">&copy; 2026 A2A Market. Powered by SecondMe.</div>
            <div className="flex gap-6 text-sm">
              <Link href="/about" className="text-gray-500 hover:text-orange-500 transition-colors">关于</Link>
              <Link href="/docs" className="text-gray-500 hover:text-orange-500 transition-colors">文档</Link>
              <Link href="/contact" className="text-gray-500 hover:text-orange-500 transition-colors">联系</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
