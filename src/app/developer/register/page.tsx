'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import Header from '@/components/Header'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export default function DeveloperRegisterPage() {
  const router = useRouter()
  const { user, loading: authLoading, mutate } = useAuth()
  const t = useTranslations('developerRegister')
  const tc = useTranslations('common')
  const notifyOptions = useMemo(
    () => [
      { value: 'in_app', label: t('notifyInApp') },
      { value: 'callback', label: t('notifyCallback') },
      { value: 'both', label: t('notifyBoth') },
      { value: 'none', label: t('notifyNone') },
    ],
    [t],
  )
  const [form, setForm] = useState({
    developerName: '',
    callbackUrl: '',
    notifyPreference: 'in_app' as string,
  })
  const [loading, setLoading] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)
  const [error, setError] = useState('')

  const isDeveloper = user?.isDeveloper ?? false

  // Pre-fill profile for existing developers
  useEffect(() => {
    if (!authLoading && isDeveloper) {
      fetch('/api/developer/profile')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            setForm({
              developerName: data.data.developerName || '',
              callbackUrl: data.data.callbackUrl || '',
              notifyPreference: data.data.notifyPreference || 'in_app',
            })
          }
        })
        .catch(() => {})
        .finally(() => setProfileLoading(false))
    } else if (!authLoading) {
      setProfileLoading(false)
    }
  }, [authLoading, isDeveloper])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const apiUrl = isDeveloper ? '/api/developer/profile' : '/api/developer/register'
      const apiMethod = isDeveloper ? 'PUT' : 'POST'
      const body = {
        developerName: form.developerName,
        callbackUrl: form.callbackUrl,
        notifyPreference: form.notifyPreference,
      }

      const res = await fetch(apiUrl, {
        method: apiMethod,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (data.success) {
        await mutate()
        router.push('/developer')
      } else {
        setError(data.error || (isDeveloper ? t('updateFailed') : t('registerFailed')))
      }
    } catch {
      setError(tc('networkError'))
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || (isDeveloper && profileLoading)) {
    return (
      <div className="min-h-screen">
        <div className="fixed inset-0 cyber-grid pointer-events-none" />
        <Header activeNav="developer" />
        <main className="relative py-20 flex items-center justify-center">
          <p className="text-gray-500">{t('loading')}</p>
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
            <p className="text-gray-600 mb-4">{t('loginPrompt')}</p>
            <Link href="/" className="text-orange-600 hover:underline">
              {t('backHome')}
            </Link>
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
              {isDeveloper ? t('titleEdit') : t('titleNew')}
            </h2>
            <p className="text-gray-500">
              {isDeveloper ? t('descEdit') : t('descNew')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="">
            <Card className="p-8 space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">
                {error}
              </div>
            )}

            <div>
              <label className="block text-orange-600 text-xs tracking-widest mb-2 font-semibold">
                {t('developerNameLabel')}
              </label>
              <input
                type="text"
                required
                value={form.developerName}
                onChange={e => setForm(f => ({ ...f, developerName: e.target.value }))}
                className="w-full bg-[#FFFBF5] border border-[#E8E0D8] text-gray-800 px-4 py-3 rounded-xl
                           focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100
                           placeholder:text-gray-300 transition-all"
                placeholder="Your developer / studio name"
              />
            </div>

            <div>
              <label className="block text-orange-600 text-xs tracking-widest mb-2 font-semibold">
                {t('callbackUrlLabel')} <span className="text-gray-300">{t('optional')}</span>
              </label>
              <input
                type="url"
                value={form.callbackUrl}
                onChange={e => setForm(f => ({ ...f, callbackUrl: e.target.value }))}
                className="w-full bg-[#FFFBF5] border border-[#E8E0D8] text-gray-800 px-4 py-3 rounded-xl
                           focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100
                           placeholder:text-gray-300 transition-all"
                placeholder="https://your-agent.example.com/webhook"
              />
              <p className="text-gray-400 text-xs mt-1">
                {t('callbackHint')}
              </p>
            </div>

            <div>
              <label className="block text-orange-600 text-xs tracking-widest mb-2 font-semibold">
                {t('notifyPreferenceLabel')}
              </label>
              <div className="grid grid-cols-2 gap-3">
                {notifyOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, notifyPreference: opt.value }))}
                    className={`px-4 py-3 text-sm tracking-wide border rounded-xl transition-all
                      ${form.notifyPreference === opt.value
                        ? 'border-orange-400 bg-orange-50 text-orange-600 font-semibold'
                        : 'border-[#E8E0D8] text-gray-400 hover:border-orange-200'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full py-4 text-center"
            >
              {loading
                ? isDeveloper
                  ? t('updating')
                  : t('registering')
                : isDeveloper
                  ? t('submitUpdate')
                  : t('submitRegister')}
            </Button>
            </Card>
          </form>
        </div>
      </main>
    </div>
  )
}
