'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Header from '@/components/Header'
import { useAuth } from '@/contexts/AuthContext'

interface AppInfo {
  id: string
  name: string
  description: string
  circle: { name: string; icon: string; color: string }
}

type Phase = 'idle' | 'generating' | 'preview' | 'confirming' | 'done' | 'manual'

const DIMENSIONS = [
  { key: 'usability', label: '易用性' },
  { key: 'creativity', label: '创意' },
  { key: 'responsiveness', label: '响应速度' },
  { key: 'fun', label: '趣味性' },
  { key: 'reliability', label: '可靠性' },
]

export default function FeedbackPage() {
  const params = useParams()
  const clientId = params.clientId as string
  const { user } = useAuth()

  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [preview, setPreview] = useState<{ content: string; structured: Record<string, any> } | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editRating, setEditRating] = useState(0)
  const [result, setResult] = useState<{ achievements: any[]; points: number } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/feedback?clientId=${clientId}&limit=1`)
      .then(r => r.json())
      .catch(() => null)

    fetch(`/api/circles`)
      .then(r => r.json())
      .then(async (circlesRes) => {
        if (!circlesRes.success) return
        for (const circle of circlesRes.data) {
          const appsRes = await fetch(`/api/circles/${circle.slug}/apps`).then(r => r.json()).catch(() => null)
          if (appsRes?.success) {
            const found = appsRes.data.find((a: any) => a.clientId === clientId || a.metadata?.clientId === clientId)
            if (found) {
              setAppInfo({ id: found.id, name: found.name, description: found.description, circle })
              return
            }
          }
        }
      })
  }, [clientId])

  const handlePAReview = async () => {
    if (!user) return
    setPhase('generating')
    setError('')

    try {
      const res = await fetch('/api/pa-action/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      })
      const data = await res.json()

      if (data.success && data.phase === 'preview') {
        setPreview(data.data)
        setEditContent(data.data.content)
        setEditRating(data.data.structured?.overallRating || 4)
        setPhase('preview')
      } else {
        setError(data.error || '生成失败')
        setPhase('idle')
      }
    } catch {
      setError('网络错误')
      setPhase('idle')
    }
  }

  const handleConfirm = async () => {
    setPhase('confirming')
    setError('')

    try {
      const res = await fetch('/api/pa-action/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          confirm: true,
          editedContent: editContent,
          editedRating: { ...preview?.structured, overallRating: editRating },
        }),
      })
      const data = await res.json()

      if (data.success) {
        setResult({ achievements: data.data.achievements || [], points: data.data.points || 0 })
        setPhase('done')
      } else {
        setError(data.error || '提交失败')
        setPhase('preview')
      }
    } catch {
      setError('网络错误')
      setPhase('preview')
    }
  }

  if (phase === 'done' && result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFBF5]">
        <div className="fixed inset-0 cyber-grid pointer-events-none" />
        <div className="relative text-center space-y-6 max-w-md mx-auto px-4">
          <div className="text-6xl pulse-glow">🐰</div>
          <h2 className="text-3xl font-extrabold text-gray-800 font-heading">PA 评价已提交!</h2>
          <p className="text-orange-500">灵枢兔已记录你的 PA 的评价</p>

          {result.points > 0 && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-full">
              <span className="text-amber-500">+20</span>
              <span className="text-amber-600 text-sm font-semibold">积分 (总计: {result.points})</span>
            </div>
          )}

          {result.achievements.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-400">解锁成就:</p>
              {result.achievements.map((a: any, i: number) => (
                <div key={i} className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-full mr-2">
                  <span>{a.icon}</span>
                  <span className="text-sm text-purple-600 font-semibold">{a.name}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-4 justify-center pt-4">
            <Button onClick={() => { setPhase('idle'); setPreview(null); setResult(null) }} size="sm">
              再评一个
            </Button>
            <Link href="/" className="px-6 py-3 border border-[#E8E0D8] text-gray-500 text-sm rounded-xl hover:border-orange-200 transition-colors">
              返回首页
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 cyber-grid pointer-events-none" />
      <Header />

      <main className="relative py-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* App Info Header */}
          <div className="text-center mb-10">
            <div className="text-4xl mb-4 pulse-glow">🐰</div>
            <h2 className="text-3xl font-extrabold text-gray-800 mb-2 font-heading">
              {appInfo ? `评价 ${appInfo.name}` : '评价应用'}
            </h2>
            {appInfo && (
              <p className="text-gray-400 text-sm mb-2">{appInfo.description}</p>
            )}
            <p className="text-gray-300 text-xs font-mono">Client ID: {clientId}</p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl mb-6">
              {error}
            </div>
          )}

          {/* PA Review Mode */}
          {phase !== 'manual' && (
            <Card className="p-8 mb-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-gray-800 font-heading mb-2">PA 智能评价</h3>
                <p className="text-gray-400 text-sm">让你的 PA 基于个性和兴趣生成个性化评价</p>
              </div>

              {phase === 'idle' && (
                <div className="text-center space-y-4">
                  {user ? (
                    <Button onClick={handlePAReview} size="lg">
                      让我的 PA 来评价
                    </Button>
                  ) : (
                    <div>
                      <p className="text-gray-400 mb-4">登录后即可使用 PA 智能评价</p>
                      <Button asChild>
                        <Link href="/api/auth/login">登录</Link>
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {phase === 'generating' && (
                <div className="text-center py-8 space-y-4">
                  <div className="inline-block">
                    <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
                  </div>
                  <p className="text-orange-500 font-semibold">PA 正在思考...</p>
                  <p className="text-gray-400 text-sm">正在基于你的兴趣和个性生成评价</p>
                </div>
              )}

              {(phase === 'preview' || phase === 'confirming') && preview && (
                <div className="space-y-6">
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
                    <p className="text-orange-600 text-xs font-semibold mb-2">PA 生成的评分</p>
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(n => (
                          <button
                            key={n}
                            onClick={() => setEditRating(n)}
                            className={`text-2xl transition-all ${n <= editRating ? 'text-amber-400 scale-110' : 'text-gray-200 hover:text-gray-300'}`}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                      <span className="text-sm text-gray-400">({editRating}/5)</span>
                    </div>

                    {preview.structured?.dimensions && (
                      <div className="grid grid-cols-5 gap-2 text-center text-xs">
                        {DIMENSIONS.map(d => (
                          <div key={d.key}>
                            <div className="text-gray-400">{d.label}</div>
                            <div className="text-orange-600 font-bold">
                              {(preview.structured.dimensions as any)?.[d.key] || '-'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-orange-600 text-xs tracking-widest mb-2 font-semibold">
                      PA 生成的评语 (可编辑)
                    </label>
                    <textarea
                      rows={4}
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      className="w-full bg-[#FFFBF5] border border-[#E8E0D8] text-gray-800 px-4 py-3 rounded-xl
                                 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100
                                 transition-all resize-none"
                    />
                  </div>

                  <div className="flex gap-4">
                    <Button
                      onClick={handleConfirm}
                      disabled={phase === 'confirming'}
                      className="flex-1 py-3 text-center"
                    >
                      {phase === 'confirming' ? '提交中...' : '确认提交'}
                    </Button>
                    <button
                      onClick={handlePAReview}
                      disabled={phase === 'confirming'}
                      className="px-6 py-3 border border-orange-200 text-orange-500 rounded-xl hover:bg-orange-50 transition-colors disabled:opacity-50"
                    >
                      重新生成
                    </button>
                  </div>
                </div>
              )}

              {phase === 'idle' && user && (
                <div className="text-center mt-6">
                  <button
                    onClick={() => setPhase('manual')}
                    className="text-gray-400 text-sm hover:text-orange-500 transition-colors"
                  >
                    或者 手动填写评价 →
                  </button>
                </div>
              )}
            </Card>
          )}

          {/* Manual Mode */}
          {phase === 'manual' && <ManualFeedbackForm clientId={clientId} onBack={() => setPhase('idle')} />}
        </div>
      </main>
    </div>
  )
}

function ManualFeedbackForm({ clientId, onBack }: { clientId: string; onBack: () => void }) {
  const [form, setForm] = useState({
    agentId: '', agentName: '', agentType: 'pa' as const,
    overallRating: 0, summary: '', details: '',
    dimensions: {} as Record<string, number>, tags: '', recommendation: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const payload: Record<string, unknown> = {
      targetClientId: clientId,
      agentId: form.agentId, agentName: form.agentName, agentType: form.agentType,
      overallRating: form.overallRating, summary: form.summary,
    }
    if (form.details) payload.details = form.details
    if (Object.keys(form.dimensions).length > 0) payload.dimensions = form.dimensions
    if (form.tags.trim()) payload.tags = form.tags.split(',').map(t => t.trim()).filter(Boolean)
    if (form.recommendation) payload.recommendation = form.recommendation

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.success) setSubmitted(true)
      else setError(data.error || '提交失败')
    } catch { setError('网络错误') }
    finally { setLoading(false) }
  }

  if (submitted) {
    return (
      <div className="text-center space-y-6 py-12">
        <div className="text-6xl pulse-glow">🐰</div>
        <h2 className="text-3xl font-extrabold text-gray-800 font-heading">感谢反馈!</h2>
        <div className="flex gap-4 justify-center">
          <Button onClick={() => setSubmitted(false)} size="sm">再提交一个</Button>
          <Link href="/" className="px-6 py-3 border border-[#E8E0D8] text-gray-500 text-sm rounded-xl hover:border-orange-200 transition-colors">返回首页</Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="text-center mb-6">
        <button onClick={onBack} className="text-orange-500 text-sm hover:text-orange-600 transition-colors">
          ← 返回 PA 智能评价
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <Card className="p-8 space-y-6">
        {error && <div className="p-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-orange-600 text-xs tracking-widest mb-2 font-semibold">AGENT ID *</label>
            <input type="text" required value={form.agentId} onChange={e => setForm(f => ({ ...f, agentId: e.target.value }))}
              className="w-full bg-[#FFFBF5] border border-[#E8E0D8] text-gray-800 px-4 py-3 rounded-xl focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 placeholder:text-gray-300 transition-all"
              placeholder="your-agent-id" />
          </div>
          <div>
            <label className="block text-orange-600 text-xs tracking-widest mb-2 font-semibold">AGENT NAME *</label>
            <input type="text" required value={form.agentName} onChange={e => setForm(f => ({ ...f, agentName: e.target.value }))}
              className="w-full bg-[#FFFBF5] border border-[#E8E0D8] text-gray-800 px-4 py-3 rounded-xl focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 placeholder:text-gray-300 transition-all"
              placeholder="Agent display name" />
          </div>
        </div>

        <div>
          <label className="block text-orange-600 text-xs tracking-widest mb-3 font-semibold">总体评分 *</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" onClick={() => setForm(f => ({ ...f, overallRating: n }))}
                className={`w-12 h-12 text-2xl transition-all rounded-lg ${n <= form.overallRating ? 'text-amber-400 scale-110 bg-amber-50' : 'text-gray-200 hover:text-gray-300'}`}>★</button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-orange-600 text-xs tracking-widest mb-2 font-semibold">一句话总结 *</label>
          <input type="text" required maxLength={200} value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
            className="w-full bg-[#FFFBF5] border border-[#E8E0D8] text-gray-800 px-4 py-3 rounded-xl focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 placeholder:text-gray-300 transition-all"
            placeholder="One-line summary" />
        </div>

        <div>
          <label className="block text-orange-600 text-xs tracking-widest mb-2 font-semibold">详细描述</label>
          <textarea rows={4} value={form.details} onChange={e => setForm(f => ({ ...f, details: e.target.value }))}
            className="w-full bg-[#FFFBF5] border border-[#E8E0D8] text-gray-800 px-4 py-3 rounded-xl focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 placeholder:text-gray-300 transition-all resize-none"
            placeholder="详细的使用体验..." />
        </div>

        <Button type="submit" disabled={loading || form.overallRating === 0}
          className="w-full py-4 text-center">
          {loading ? '提交中...' : '提交反馈'}
        </Button>
        </Card>
      </form>
    </div>
  )
}
