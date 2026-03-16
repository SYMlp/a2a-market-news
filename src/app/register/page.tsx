'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/Header'
import { useAuth } from '@/contexts/AuthContext'

const CIRCLES = [
  { value: 'internet', emoji: '🌐', label: '互联网圈', desc: '实用型' },
  { value: 'game', emoji: '🎮', label: '游戏圈', desc: '娱乐型' },
  { value: 'wilderness', emoji: '🚀', label: '无人区圈', desc: '实验型' },
] as const

export default function RegisterAAPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    circleType: 'internet',
  })

  if (authLoading) {
    return (
      <div className="min-h-screen">
        <Header activeNav="developer" />
        <div className="flex items-center justify-center py-32">
          <div className="text-orange-500 text-xl">加载中...</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen">
        <Header activeNav="developer" />
        <div className="flex flex-col items-center justify-center py-32 gap-6">
          <p className="text-gray-500 text-lg">登录后才能注册应用</p>
          <Link href="/api/auth/login" className="cyber-btn text-sm">
            登录
          </Link>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/app-pa/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          circleType: formData.circleType,
        }),
      })

      const data = await response.json()

      if (data.success) {
        router.push(`/app-pa/${data.data.id}`)
      } else {
        setError(data.error || '注册失败')
      }
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 cyber-grid pointer-events-none" />

      <Header activeNav="developer" />

      <section className="relative py-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h1 className="text-4xl font-extrabold text-gray-800 mb-4 font-heading">
              注册你的 AA
            </h1>
            <p className="text-lg text-gray-500">
              只需三步，快速注册你的 A2A 应用
            </p>
            <p className="text-sm text-gray-400 mt-2">
              注册后可在设置页补充 Client ID、链接等详细信息
            </p>
          </div>

          <form onSubmit={handleSubmit} className="cyber-card p-8 space-y-8">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">
                应用名称 *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                className="w-full px-4 py-3 bg-[#FFFBF5] border border-[#E8E0D8] rounded-xl text-gray-800
                           focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all"
                placeholder="例如：狼人杀 A2A"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">
                一句话介绍 *
              </label>
              <input
                type="text"
                required
                value={formData.description}
                onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                className="w-full px-4 py-3 bg-[#FFFBF5] border border-[#E8E0D8] rounded-xl text-gray-800
                           focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all"
                placeholder="例如：基于 PA 人格的狼人杀游戏"
                maxLength={100}
              />
              <div className="text-right text-xs text-gray-300 mt-1">{formData.description.length}/100</div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-3">
                赛道选择 *
              </label>
              <div className="grid grid-cols-3 gap-4">
                {CIRCLES.map(circle => (
                  <button
                    key={circle.value}
                    type="button"
                    onClick={() => setFormData(f => ({ ...f, circleType: circle.value }))}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      formData.circleType === circle.value
                        ? 'border-orange-400 bg-orange-50'
                        : 'border-[#E8E0D8] bg-white hover:border-orange-200'
                    }`}
                  >
                    <div className="text-2xl mb-2">{circle.emoji}</div>
                    <div className="text-sm font-bold text-gray-800">{circle.label}</div>
                    <div className="text-xs text-gray-400 mt-1">{circle.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4 justify-center pt-4">
              <Link
                href="/developer"
                className="px-8 py-3 bg-transparent border-2 border-gray-200 text-gray-500 font-semibold tracking-wide rounded-xl
                           hover:border-gray-300 hover:text-gray-600 transition-all duration-300"
              >
                取消
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="cyber-btn disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '注册中...' : '注册应用'}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  )
}
