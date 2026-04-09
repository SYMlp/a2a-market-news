'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import Header from '@/components/Header'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

type CircleType = 'internet' | 'game' | 'wilderness' | ''

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
  const t = useTranslations('registerApp')
  const tc = useTranslations('common')
  const circles = useMemo(
    () =>
      [
        { value: 'internet' as const, emoji: '🌐', label: t('circleInternet'), desc: t('circleInternetDesc') },
        { value: 'game' as const, emoji: '🎮', label: t('circleGame'), desc: t('circleGameDesc') },
        { value: 'wilderness' as const, emoji: '🚀', label: t('circleWilderness'), desc: t('circleWildernessDesc') },
      ] as const,
    [t],
  )

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
            if (circles.some(c => c.value === ct)) {
              next.circleType = ct as CircleType
              filled.circleType = true
            }
          }
          return next
        })

        setPaFilled(filled)
      } else {
        setError(data.error || t('paSuggestFailed'))
      }
    } catch {
      setError(tc('networkError'))
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
        setError(data.error || t('registerFailed'))
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
          <p className="text-gray-500">{tc('loading')}</p>
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
            <p className="text-gray-600 mb-4">{t('loginToRegister')}</p>
            <Button asChild size="sm">
              <Link href="/api/auth/login">{tc('login')}</Link>
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
              <span className="text-orange-600 text-sm tracking-wide">{t('developerBadge')}</span>
            </div>
            <h2 className="text-3xl font-extrabold text-gray-800 mb-4 font-heading">
              {t('registerDevFirst')}
            </h2>
            <p className="text-gray-500 mb-8">
              {t('registerDevHint')}
            </p>
            <Button asChild>
              <Link href="/developer/register">{t('goDeveloperRegister')}</Link>
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
              <span className="text-orange-600 text-sm tracking-wide">{t('badge')}</span>
            </div>
            <h2 className="text-4xl font-extrabold text-gray-800 mb-4 font-heading">
              {t('title')}
            </h2>
            <p className="text-gray-500">
              {t('subtitle')}
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
                      {t('paThinking')}
                    </>
                  ) : (
                    t('paAssistFill')
                  )}
                </button>
              </div>

              {/* Name */}
              <div>
                <label className="block text-orange-600 text-xs tracking-widest mb-2 font-semibold">
                  {t('appNameLabel')}
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
                  placeholder={t('namePlaceholder')}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-orange-600 text-xs tracking-widest mb-2 font-semibold">
                  {t('appDescLabel')}
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
                  placeholder={t('descPlaceholder')}
                />
              </div>

              {/* Circle Type */}
              <div>
                <label className="block text-orange-600 text-xs tracking-widest mb-2 font-semibold">
                  {t('circleLabel')}
                  {paFilled.circleType && <PaBadge />}
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {circles.map(c => (
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
                  {t('clientIdLabel')} <span className="text-gray-300">{t('clientIdOptional')}</span>
                </label>
                <input
                  type="text"
                  value={form.clientId}
                  onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
                  className="w-full bg-[#FFFBF5] border border-[#E8E0D8] text-gray-800 px-4 py-3 rounded-xl
                    focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100
                    placeholder:text-gray-300 transition-all font-mono text-sm"
                  placeholder={t('clientIdPlaceholder')}
                />
                <p className="text-gray-400 text-xs mt-1">
                  {t('clientIdHint')}
                </p>
              </div>

              <Button
                type="submit"
                disabled={submitting || !form.name.trim() || !form.description.trim() || !form.circleType}
                className="w-full py-4 text-center"
              >
                {submitting ? t('submitting') : t('submit')}
              </Button>
            </Card>
          </form>
        </div>
      </main>
    </div>
  )
}

function PaBadge() {
  const t = useTranslations('registerApp')
  return (
    <span className="ml-2 inline-flex items-center px-2 py-0.5 bg-indigo-50 border border-indigo-200 rounded-full text-[10px] text-indigo-500 font-normal">
      {t('paSuggestionBadge')}
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
