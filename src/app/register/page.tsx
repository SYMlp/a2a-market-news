'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/Header'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

const CIRCLES = [
  { value: 'internet', emoji: '🌐', label: '互联网圈', desc: '实用型' },
  { value: 'game', emoji: '🎮', label: '游戏圈', desc: '娱乐型' },
  { value: 'wilderness', emoji: '🚀', label: '无人区圈', desc: '实验型' },
] as const

type CircleType = (typeof CIRCLES)[number]['value']

interface FormState {
  name: string
  description: string
  circleType: CircleType | ''
  clientId: string
}

interface PaFilledFields {
  name?: boolean
  description?: boolean
  circleType?: boolean
}

export default function RegisterPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [form, setForm] = useState<FormState>({
    name: '',
    description: '',
    circleType: '',
    clientId: '',
  })
  const [paFilled, setPaFilled] = useState<PaFilledFields>({})
  const [paLoading, setPaLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isDeveloper = user?.isDeveloper ?? false

  const handlePaFill = async () => {
    setPaLoading(true)
    setError('')
    try {
      const res = await fetch('/api/pa/suggest-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formType: 'register' }),
      })
      const data = await res.json()

      if (data.success && data.suggestions) {
        const s = data.suggestions as Record<string, { value: string | number }>
        const filled: PaFilledFields = {}

        setForm(prev => {
          const next = { ...prev }
          if (s.name?.value) {
            next.name = String(s.name.value)
            filled.name = true
          }
          if (s.description?.value) {
            next.description = String(s.description.value)
            filled.description = true
          }
          if (s.circleType?.value) {
            const ct = String(s.circleType.value)
            if (CIRCLES.some(c => c.value === ct)) {
              next.circleType = ct as CircleType
              filled.circleType = true
            }
          }
          return next
        })

        setPaFilled(filled)
      } else {
        setError(data.error || 'PA 建议获取失败')
      }
    } catch {
      setError('网络错误，请稍后再试')
    } finally {
      setPaLoading(false)
    }
  }

  const clearPaIndicator = (field: keyof PaFilledFields) => {
    setPaFilled(prev => ({ ...prev, [field]: false }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.description.trim() || !form.circleType) return

    setSubmitting(true)
    setError('')

    try {
      const body: Record<string, string> = {
        name: form.name.trim(),
        description: form.description.trim(),
        circleType: form.circleType,
      }
      if (form.clientId.trim()) {
        body.clientId = form.clientId.trim()
      }

      const res = await fetch('/api/developer/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (data.success) {
        router.push(`/app-pa/${data.data.id}`)
      } else {
        setError(data.error || '注册失败')
      }
    } catch {
      setError('网络错误，请稍后再试')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen">
        <div className="fixed inset-0 cyber-grid pointer-events-none" />
        <Header activeNav="developer" />
        <main className="relative py-20 flex items-center justify-center">
          <p className="text-gray-500">加载中...</p>
        </main>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen">
        <div className="fixed inset-0 cyber-grid pointer-events-none" />
        <Header activeNav="developer" />
        <main className="relative py-20">
          <div className="max-w-2xl mx-auto px-4 text-center">
            <p className="text-gray-600 mb-4">登录后才能注册应用</p>
            <Button asChild size="sm">
              <Link href="/api/auth/login">登录</Link>
            </Button>
          </div>
        </main>
      </div>
    )
  }

  if (!isDeveloper) {
    return (
      <div className="min-h-screen">
        <div className="fixed inset-0 cyber-grid pointer-events-none" />
        <Header activeNav="developer" />
        <main className="relative py-20">
          <div className="max-w-2xl mx-auto px-4 text-center">
            <div className="inline-block px-6 py-2 bg-orange-50 border border-orange-200 rounded-full mb-6">
              <span className="text-orange-600 text-sm tracking-wide">需要开发者身份</span>
            </div>
            <h2 className="text-3xl font-extrabold text-gray-800 mb-4 font-heading">
              先注册成为开发者
            </h2>
            <p className="text-gray-500 mb-8">
              注册应用前需要先完成开发者注册
            </p>
            <Button asChild>
              <Link href="/developer/register">前往开发者注册</Link>
            </Button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 cyber-grid pointer-events-none" />

      <Header activeNav="developer" />

      <main className="relative py-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-block px-6 py-2 bg-orange-50 border border-orange-200 rounded-full mb-6">
              <span className="text-orange-600 text-sm tracking-wide">注册新应用</span>
            </div>
            <h2 className="text-4xl font-extrabold text-gray-800 mb-4 font-heading">
              注册 A2A 应用
            </h2>
            <p className="text-gray-500">
              填写应用信息，让 PA 和用户发现你的应用
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <Card className="p-8 space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">
                  {error}
                </div>
              )}

              {/* PA-assisted fill */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handlePaFill}
                  disabled={paLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200
                    text-indigo-600 text-sm font-semibold rounded-xl
                    hover:bg-indigo-100 hover:border-indigo-300 transition-all
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {paLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                      PA 思考中...
                    </>
                  ) : (
                    'PA 帮我填写'
                  )}
                </button>
              </div>

              {/* Name */}
              <div>
                <label className="block text-orange-600 text-xs tracking-widest mb-2 font-semibold">
                  应用名称 *
                  {paFilled.name && <PaBadge />}
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => {
                    setForm(f => ({ ...f, name: e.target.value }))
                    clearPaIndicator('name')
                  }}
                  className={fieldClass(paFilled.name)}
                  placeholder="给你的应用取个名字"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-orange-600 text-xs tracking-widest mb-2 font-semibold">
                  应用描述 *
                  {paFilled.description && <PaBadge />}
                </label>
                <textarea
                  required
                  rows={4}
                  value={form.description}
                  onChange={e => {
                    setForm(f => ({ ...f, description: e.target.value }))
                    clearPaIndicator('description')
                  }}
                  className={fieldClass(paFilled.description)}
                  placeholder="描述一下你的应用做什么、有什么特色"
                />
              </div>

              {/* Circle Type */}
              <div>
                <label className="block text-orange-600 text-xs tracking-widest mb-2 font-semibold">
                  赛道 *
                  {paFilled.circleType && <PaBadge />}
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {CIRCLES.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => {
                        setForm(f => ({ ...f, circleType: c.value }))
                        clearPaIndicator('circleType')
                      }}
                      className={`flex flex-col items-center gap-1 px-4 py-4 border rounded-xl transition-all text-sm
                        ${form.circleType === c.value
                          ? 'border-orange-400 bg-orange-50 text-orange-600 font-semibold shadow-sm'
                          : 'border-[#E8E0D8] text-gray-400 hover:border-orange-200'
                        }`}
                    >
                      <span className="text-xl">{c.emoji}</span>
                      <span>{c.label}</span>
                      <span className="text-[11px] text-gray-300">{c.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Client ID */}
              <div>
                <label className="block text-orange-600 text-xs tracking-widest mb-2 font-semibold">
                  Client ID <span className="text-gray-300">(可选)</span>
                </label>
                <input
                  type="text"
                  value={form.clientId}
                  onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
                  className="w-full bg-[#FFFBF5] border border-[#E8E0D8] text-gray-800 px-4 py-3 rounded-xl
                    focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100
                    placeholder:text-gray-300 transition-all font-mono text-sm"
                  placeholder="留空则自动生成"
                />
                <p className="text-gray-400 text-xs mt-1">
                  在 SecondMe 开发者后台查看
                </p>
              </div>

              <Button
                type="submit"
                disabled={submitting || !form.name.trim() || !form.description.trim() || !form.circleType}
                className="w-full py-4 text-center"
              >
                {submitting ? '注册中...' : '注册应用'}
              </Button>
            </Card>
          </form>
        </div>
      </main>
    </div>
  )
}

function PaBadge() {
  return (
    <span className="ml-2 inline-flex items-center px-2 py-0.5 bg-indigo-50 border border-indigo-200 rounded-full text-[10px] text-indigo-500 font-normal">
      PA 建议
    </span>
  )
}

function fieldClass(isPaFilled?: boolean): string {
  const base = [
    'w-full px-4 py-3 rounded-xl transition-all',
    'focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100',
    'placeholder:text-gray-300',
  ].join(' ')

  if (isPaFilled) {
    return `${base} bg-indigo-50/40 border border-indigo-200 text-gray-800`
  }
  return `${base} bg-[#FFFBF5] border border-[#E8E0D8] text-gray-800`
}
