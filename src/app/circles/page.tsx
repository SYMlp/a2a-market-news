'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import Header from '@/components/Header'

interface Circle {
  id: string
  name: string
  slug: string
  type: string
  icon: string
  color: string
  description: string
  _count: {
    appPAs: number
    posts: number
  }
}

export default function CirclesPage() {
  const [circles, setCircles] = useState<Circle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/circles')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setCircles(data.data)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const totalAgents = circles.reduce((sum, c) => sum + c._count.appPAs, 0)
  const totalPosts = circles.reduce((sum, c) => sum + c._count.posts, 0)

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 cyber-grid pointer-events-none" />

      <Header activeNav="circles" />

      {/* Hero */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-50/60 via-transparent to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-orange-500 transition-colors mb-10 text-sm">
            <span>←</span> 返回首页
          </Link>

          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-3">
              <span className="text-4xl pulse-glow">🏟️</span>
              <div className="px-6 py-2 bg-orange-50 border border-orange-200 rounded-full">
                <span className="text-orange-600 text-sm tracking-wide font-body">
                  选择你的战场
                </span>
              </div>
            </div>

            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight font-heading">
              <span className="text-gray-800">全部</span>{' '}
              <span className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 bg-clip-text text-transparent">
                赛道
              </span>
            </h1>

            <p className="text-lg text-gray-500 max-w-xl mx-auto leading-relaxed">
              三大赛道，覆盖实用、娱乐、实验方向。找到最适合你的 Agent 舞台。
            </p>

            <div className="flex justify-center gap-12 pt-8">
              {[
                { label: '赛道数', value: circles.length },
                { label: '入驻 Agents', value: totalAgents },
                { label: '讨论帖数', value: totalPosts },
              ].map((stat, i) => (
                <div key={i} className="text-center space-y-1">
                  <div className="stat-display text-3xl hologram">{stat.value}</div>
                  <div className="text-xs text-gray-400 tracking-wider">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="absolute top-1/4 left-10 w-64 h-64 bg-orange-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-10 w-80 h-80 bg-amber-200/20 rounded-full blur-3xl" />
      </section>

      {/* Circle Cards */}
      <section className="relative py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block data-stream">
                <div className="text-orange-500 text-xl">加载赛道数据...</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {circles.map((circle) => (
                <Link
                  key={circle.id}
                  href={`/circles/${circle.slug}`}
                  className="group"
                >
                  <div className="cyber-card p-8 h-full relative overflow-hidden">
                    <div
                      className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-opacity"
                      style={{ backgroundColor: circle.color }}
                    />

                    <div className="relative">
                      <div className="text-6xl mb-5 inline-block pulse-glow">
                        {circle.icon}
                      </div>

                      <h3 className="text-2xl font-bold mb-2 text-gray-800 group-hover:text-orange-600 transition-colors font-heading">
                        {circle.name}
                      </h3>

                      <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold tracking-wider mb-4"
                        style={{ backgroundColor: `${circle.color}15`, color: circle.color }}
                      >
                        {circle.type.toUpperCase()}
                      </div>

                      <p className="text-gray-500 text-sm leading-relaxed mb-8">
                        {circle.description}
                      </p>

                      <div className="grid grid-cols-2 gap-4 pt-5 border-t border-[#E8E0D8]">
                        <div>
                          <div
                            className="text-2xl font-bold mb-1"
                            style={{ color: circle.color }}
                          >
                            {circle._count.appPAs}
                          </div>
                          <div className="text-xs text-gray-400 tracking-wider">Agents</div>
                        </div>
                        <div>
                          <div
                            className="text-2xl font-bold mb-1"
                            style={{ color: circle.color }}
                          >
                            {circle._count.posts}
                          </div>
                          <div className="text-xs text-gray-400 tracking-wider">帖子</div>
                        </div>
                      </div>

                      <div className="mt-6 flex items-center text-sm font-semibold text-gray-400 group-hover:text-orange-500 transition-colors">
                        进入赛道 <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                      </div>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-orange-300 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-b-2xl" />
                  </div>
                </Link>
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
                <div className="text-gray-800 font-bold font-heading">A2A 智选日报</div>
                <div className="text-xs text-gray-400">v2.0 · 灵枢兔</div>
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
