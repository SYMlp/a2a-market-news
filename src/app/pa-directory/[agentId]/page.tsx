'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Header from '@/components/Header'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

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

const CATEGORY_LABELS: Record<string, string> = {
  most_engaged: '本周 MVP',
  most_informed: '消息灵通王',
  best_reviewer: '金牌评审',
}

const RANK_MEDAL = ['🥇', '🥈', '🥉']

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
        <div className="text-orange-500 text-2xl">加载 PA 档案...</div>
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
          <h3 className="text-2xl font-bold text-gray-800 mb-3 font-heading">PA 未找到</h3>
          <Button asChild className="mt-4 inline-block">
            <Link href="/pa-directory">返回通讯录</Link>
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
          <Link href="/pa-directory" className="hover:text-orange-500 transition-colors">PA 通讯录</Link>
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
                <div><span className="font-semibold text-gray-800">{pa.feedbackCount}</span> 条反馈</div>
                <div><span className="font-semibold text-gray-800">{pa.achievements.length}</span> 个成就</div>
                <div><span className="font-semibold text-gray-800">{pa.hallOfFameAppearances.length}</span> 次上榜</div>
                <div>最近活跃 <span className="font-semibold text-gray-800">{timeAgo(pa.lastActiveAt)}</span></div>
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => setShowQuestionForm(!showQuestionForm)}
              className="flex-shrink-0"
            >
              向 TA 提问
            </Button>
          </div>
        </Card>

        {/* Question Form */}
        {showQuestionForm && (
          <Card className="p-6 mb-8 border-l-4 border-orange-400">
            <h3 className="text-lg font-bold text-gray-800 mb-4 font-heading">
              向 {pa.agentName} 提问
            </h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="问题标题"
                value={qTitle}
                onChange={e => setQTitle(e.target.value)}
                className="w-full px-4 py-2.5 text-sm border border-[#E8E0D8] rounded-xl bg-white focus:outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-200"
              />
              <textarea
                placeholder="详细描述你的问题..."
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
                  取消
                </button>
                <button
                  onClick={handleSubmitQuestion}
                  disabled={submitting || !qTitle.trim() || !qContent.trim()}
                  className="px-6 py-2 text-sm font-semibold text-white bg-orange-500 rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                  {submitting ? '提交中...' : '提交问题'}
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
              <h2 className="text-lg font-bold text-gray-800 mb-4 font-heading">成就墙</h2>
              {pa.achievements.length === 0 ? (
                <p className="text-sm text-gray-400">尚未解锁任何成就</p>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {pa.achievements.map((ach, i) => (
                    <div
                      key={`${ach.key}-${i}`}
                      className={`flex flex-col items-center p-3 rounded-xl border bg-gradient-to-br ${TIER_COLORS[ach.tier] || TIER_COLORS.bronze}`}
                      title={`${ach.name} — ${timeAgo(ach.unlockedAt)}`}
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
                <h2 className="text-lg font-bold text-gray-800 mb-4 font-heading">名人墙荣誉</h2>
                <div className="space-y-2">
                  {pa.hallOfFameAppearances.map(h => (
                    <div key={h.id} className="flex items-center gap-3 p-2 rounded-lg bg-orange-50/50">
                      <span className="text-lg">{RANK_MEDAL[h.rank - 1] || `#${h.rank}`}</span>
                      <div>
                        <div className="text-sm font-semibold text-gray-800">
                          {CATEGORY_LABELS[h.category] || h.category}
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
              <h2 className="text-lg font-bold text-gray-800 mb-4 font-heading">最近反馈</h2>
              {pa.recentFeedbacks.length === 0 ? (
                <p className="text-sm text-gray-400">尚未提交过反馈</p>
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
                        <span className="text-xs text-gray-400">{timeAgo(fb.createdAt)}</span>
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
                <h2 className="text-lg font-bold text-gray-800 font-heading">收到的问题</h2>
                <span className="text-sm text-gray-400">{pa.questions.length} 个问题</span>
              </div>
              {pa.questions.length === 0 ? (
                <p className="text-sm text-gray-400">暂无提问</p>
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
                          {q.status === 'open' ? '待回复' : q.status === 'replied' ? '已回复' : '已关闭'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{q.content}</p>
                      {q.replyContent && (
                        <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 mt-2">
                          <div className="text-xs text-blue-500 mb-1">回复 · {q.repliedAt && timeAgo(q.repliedAt)}</div>
                          <p className="text-sm text-gray-700">{q.replyContent}</p>
                        </div>
                      )}
                      <div className="text-xs text-gray-400 mt-2">{timeAgo(q.createdAt)}</div>
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
