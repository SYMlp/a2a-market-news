'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import Header from '@/components/Header'
import { Card } from '@/components/ui/Card'

interface Practice {
  id: string
  title: string
  summary: string
  tags: string[]
  category: string
  viewCount: number
  likeCount: number
  createdAt: string
  author: {
    id: string
    name: string | null
    avatarUrl: string | null
  }
}

const CATEGORIES = [
  { value: '', label: '全部' },
  { value: 'practice', label: '最佳实践' },
  { value: 'showcase', label: '案例展示' },
  { value: 'tip', label: '技巧' },
] as const

const CATEGORY_ICONS: Record<string, string> = {
  practice: '📋',
  showcase: '🏗️',
  tip: '💡',
}

export default function PracticesPage() {
  const [practices, setPractices] = useState<Practice[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const fetchPractices = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (activeCategory) params.set('category', activeCategory)
    if (activeTag) params.set('tag', activeTag)

    try {
      const res = await fetch(`/api/practices?${params}`)
      const data = await res.json()
      setPractices(data.practices ?? [])
      setTotal(data.total ?? 0)
    } catch {
      setPractices([])
    } finally {
      setLoading(false)
    }
  }, [page, activeCategory, activeTag])

  useEffect(() => {
    fetchPractices()
  }, [fetchPractices])

  const allTags = Array.from(
    new Set(practices.flatMap(p => (Array.isArray(p.tags) ? p.tags : [])))
  )

  const totalPages = Math.max(1, Math.ceil(total / 12))

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 cyber-grid pointer-events-none" />

      <Header activeNav="practices" />

      {/* Hero */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-50/60 via-transparent to-transparent" />
        <div className="absolute top-1/4 left-10 w-64 h-64 bg-orange-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-10 w-80 h-80 bg-amber-200/20 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-3">
              <span className="text-5xl">📝</span>
              <div className="px-6 py-2 bg-orange-50 border border-orange-200 rounded-full">
                <span className="text-orange-600 text-sm tracking-wide font-body">开发者实践</span>
              </div>
            </div>

            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight font-heading">
              <span className="block text-gray-800">Developer</span>
              <span className="block bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 bg-clip-text text-transparent">
                实践分享
              </span>
            </h1>

            <p className="text-lg text-gray-500 max-w-xl mx-auto">
              来自社区开发者的最佳实践、案例展示与技巧心得
            </p>

            <div className="grid grid-cols-3 gap-8 max-w-lg mx-auto pt-8">
              {[
                { label: '实践总数', value: total },
                { label: '分类', value: CATEGORIES.length - 1 },
                { label: '标签', value: allTags.length },
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

      {/* Filters */}
      <section className="relative border-y border-[#E8E0D8] bg-white/50 sticky top-20 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4">
            {/* Category Tabs */}
            <div className="flex gap-2 flex-wrap items-center">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => { setActiveCategory(cat.value); setPage(1) }}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                    activeCategory === cat.value
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'bg-white text-gray-400 border border-[#E8E0D8] hover:border-orange-200 hover:text-gray-600'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Tag Pills */}
            {allTags.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {activeTag && (
                  <button
                    onClick={() => { setActiveTag(null); setPage(1) }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-full bg-orange-50 text-orange-600 border border-orange-200"
                  >
                    {activeTag} ✕
                  </button>
                )}
                {allTags.filter(t => t !== activeTag).slice(0, 8).map(tag => (
                  <button
                    key={tag}
                    onClick={() => { setActiveTag(tag); setPage(1) }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-full bg-white text-gray-400 border border-[#E8E0D8] hover:border-orange-200 hover:text-gray-600 transition-all"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Practice Cards */}
      <section className="relative py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="text-center py-24">
              <div className="text-orange-500 text-2xl">加载实践列表...</div>
            </div>
          ) : practices.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {practices.map(practice => (
                  <Link key={practice.id} href={`/practices/${practice.id}`} className="block group">
                    <Card className="p-6 h-full flex flex-col">
                      {/* Category badge */}
                      <div className="flex items-center justify-between mb-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                          {CATEGORY_ICONS[practice.category] || '📝'} {
                            CATEGORIES.find(c => c.value === practice.category)?.label || practice.category
                          }
                        </span>
                        <span className="text-xs text-gray-300">
                          {new Date(practice.createdAt).toLocaleDateString('zh-CN')}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="text-lg font-bold text-gray-800 mb-2 group-hover:text-orange-600 transition-colors font-heading line-clamp-2">
                        {practice.title}
                      </h3>

                      {/* Summary */}
                      <p className="text-sm text-gray-500 mb-4 flex-1 line-clamp-3">
                        {practice.summary}
                      </p>

                      {/* Tags */}
                      {Array.isArray(practice.tags) && practice.tags.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap mb-4">
                          {practice.tags.slice(0, 4).map(tag => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 text-[11px] rounded-md bg-gray-50 text-gray-400 border border-gray-100"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-4 border-t border-[#E8E0D8]">
                        <div className="flex items-center gap-2">
                          {practice.author.avatarUrl ? (
                            <img
                              src={practice.author.avatarUrl}
                              alt=""
                              className="w-6 h-6 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-300 to-amber-400 flex items-center justify-center text-[10px] text-white font-bold">
                              {(practice.author.name || 'U')[0]}
                            </div>
                          )}
                          <span className="text-xs text-gray-500 truncate max-w-[100px]">
                            {practice.author.name || '匿名'}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            👁️ {practice.viewCount}
                          </span>
                          <span className="flex items-center gap-1">
                            ❤️ {practice.likeCount}
                          </span>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-12">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-4 py-2 text-sm font-semibold rounded-lg border border-[#E8E0D8] text-gray-500 hover:border-orange-200 hover:text-orange-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    上一页
                  </button>
                  <span className="px-4 py-2 text-sm text-gray-500">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-4 py-2 text-sm font-semibold rounded-lg border border-[#E8E0D8] text-gray-500 hover:border-orange-200 hover:text-orange-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    下一页
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-24">
              <div className="text-6xl mb-6">📝</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3 font-heading">暂无实践分享</h3>
              <p className="text-gray-400 mb-8">成为第一个分享实践经验的开发者</p>
              <Link
                href="/practices/new"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-amber-600 transition-all shadow-md"
              >
                分享实践
              </Link>
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
