'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import Header from '@/components/Header'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface AppData {
  id: string
  name: string
  description: string
  status: string
  clientId: string | null
  website: string | null
  logo: string | null
  metadata: {
    clientId?: string
    accessibility?: string
    links?: {
      github?: string
      project?: string
      video?: string
    }
    detailedDescription?: string
  } | null
  circle: { name: string; slug: string; type: string }
}

export default function AppSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const appId = params.id as string
  const { user, loading: authLoading } = useAuth()
  const t = useTranslations('developerSettings')

  const [app, setApp] = useState<AppData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    name: '',
    description: '',
    clientId: '',
    coverImage: '',
    githubUrl: '',
    projectUrl: '',
    videoUrl: '',
    detailedDescription: '',
    accessibility: 'none',
  })
  const [showArchivedConfirm, setShowArchivedConfirm] = useState(false)

  const clientIdLocked = !!(app?.clientId && !app.clientId.startsWith('app-'))

  useEffect(() => {
    if (authLoading) return
    if (!user) return

    fetch(`/api/developer/apps/${appId}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          const a = data.data as AppData
          setApp(a)
          setForm({
            name: a.name || '',
            description: a.description || '',
            clientId: a.clientId || '',
            coverImage: a.logo || '',
            githubUrl: a.metadata?.links?.github || '',
            projectUrl: a.website || a.metadata?.links?.project || '',
            videoUrl: a.metadata?.links?.video || '',
            detailedDescription: a.metadata?.detailedDescription || '',
            accessibility: a.metadata?.accessibility || 'none',
          })
        } else {
          setError(data.error || t('appNotFound'))
        }
        setLoading(false)
      })
      .catch(() => {
        setError(t('networkError'))
        setLoading(false)
      })
  }, [appId, user, authLoading, t])

  const handleStatusChange = async (newStatus: string) => {
    if (!app || saving || app.status === 'archived') return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch(`/api/developer/apps/${app.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (data.success) {
        setSuccess(t('statusUpdated'))
        setApp(data.data)
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(data.error || t('updateFailed'))
      }
    } catch {
      setError(t('networkError'))
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent, statusOverride?: string) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        description: form.description,
        clientId: form.clientId || null,
        website: form.projectUrl || null,
        logo: form.coverImage || null,
        metadata: {
          ...(app?.metadata || {}),
          accessibility: form.accessibility,
          detailedDescription: form.detailedDescription,
          links: {
            github: form.githubUrl || undefined,
            project: form.projectUrl || undefined,
            video: form.videoUrl || undefined,
          },
        },
      }
      if (statusOverride !== undefined) payload.status = statusOverride

      const res = await fetch(`/api/developer/apps/${app!.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.success) {
        setSuccess(statusOverride === 'archived' ? t('archivedSuccess') : t('saveSuccess'))
        setApp(data.data)
        setShowArchivedConfirm(false)
        if (statusOverride === 'archived') {
          setTimeout(() => router.push('/developer'), 1500)
        } else {
          setTimeout(() => setSuccess(''), 3000)
        }
      } else {
        setError(data.error || t('saveFailed'))
      }
    } catch {
      setError(t('networkError'))
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen">
        <Header activeNav="developer" />
        <div className="flex items-center justify-center py-32">
          <div className="text-orange-500 text-xl">{t('loading')}</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen">
        <Header activeNav="developer" />
        <div className="flex flex-col items-center justify-center py-32 gap-6">
          <p className="text-gray-500 text-lg">{t('login')}</p>
          <Button asChild size="sm">
            <Link href="/api/auth/login">{t('loginButton')}</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (!app) {
    return (
      <div className="min-h-screen">
        <Header activeNav="developer" />
        <div className="flex flex-col items-center justify-center py-32 gap-6">
          <p className="text-gray-500 text-lg">{error || t('appNotFound')}</p>
          <Button asChild size="sm">
            <Link href="/developer">{t('backPanel')}</Link>
          </Button>
        </div>
      </div>
    )
  }

  const inputClass = "w-full px-4 py-3 bg-[#FFFBF5] border border-[#E8E0D8] rounded-xl text-gray-800 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all"

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 cyber-grid pointer-events-none" />

      <Header activeNav="developer" />

      <main className="relative py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <Link href="/developer" className="text-gray-400 hover:text-orange-500 transition-colors text-sm mb-4 inline-block">
              {t('backToPanel')}
            </Link>
            <h2 className="text-3xl font-extrabold text-gray-800 mb-2 font-heading">
              {t('title')}
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-gray-500">{app.name}</span>
              <span className={`circle-badge ${app.circle.slug}`}>{app.circle.name}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">
                {error}
              </div>
            )}
            {success && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm rounded-xl">
                {success}
              </div>
            )}

            <Card className="p-8 space-y-6">
              <h3 className="text-xl font-bold text-gray-800 font-heading">{t('basicInfo')}</h3>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">{t('appName')}</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">{t('tagline')}</label>
                <input
                  type="text"
                  required
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className={inputClass}
                  maxLength={100}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  {t('clientIdLabel')}
                  {clientIdLocked && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded-full text-[10px] text-emerald-600 font-normal">
                      {t('bound')}
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={form.clientId}
                  onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
                  readOnly={clientIdLocked}
                  className={`${inputClass} font-mono text-sm ${clientIdLocked ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}`}
                  placeholder="526d9920-c43c-4512-917d-5f59f706f087"
                />
                <p className="mt-1 text-xs text-gray-400">
                  {clientIdLocked ? t('clientIdLockedHint') : t('clientIdUnlockedHint')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">{t('accessibility')}</label>
                <select
                  value={form.accessibility}
                  onChange={e => setForm(f => ({ ...f, accessibility: e.target.value }))}
                  className={inputClass}
                >
                  <option value="none">{t('accNone')}</option>
                  <option value="partial">{t('accPartial')}</option>
                  <option value="full">{t('accFull')}</option>
                </select>
              </div>
            </Card>

            <Card className="p-8 space-y-6">
              <h3 className="text-xl font-bold text-gray-800 font-heading">{t('linksTitle')}</h3>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">{t('coverUrl')}</label>
                <input
                  type="url"
                  value={form.coverImage}
                  onChange={e => setForm(f => ({ ...f, coverImage: e.target.value }))}
                  className={inputClass}
                  placeholder="https://example.com/cover.png"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">{t('projectUrl')}</label>
                <input
                  type="url"
                  value={form.projectUrl}
                  onChange={e => setForm(f => ({ ...f, projectUrl: e.target.value }))}
                  className={inputClass}
                  placeholder="https://your-app.com"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">{t('githubUrl')}</label>
                <input
                  type="url"
                  value={form.githubUrl}
                  onChange={e => setForm(f => ({ ...f, githubUrl: e.target.value }))}
                  className={inputClass}
                  placeholder="https://github.com/username/repo"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">{t('videoUrl')}</label>
                <input
                  type="url"
                  value={form.videoUrl}
                  onChange={e => setForm(f => ({ ...f, videoUrl: e.target.value }))}
                  className={inputClass}
                  placeholder="https://youtube.com/watch?v=..."
                />
              </div>
            </Card>

            <Card className="p-8 space-y-6">
              <h3 className="text-xl font-bold text-gray-800 font-heading">{t('detailedTitle')}</h3>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  {t('detailedLabel')}
                </label>
                <textarea
                  value={form.detailedDescription}
                  onChange={e => setForm(f => ({ ...f, detailedDescription: e.target.value }))}
                  rows={10}
                  className={`${inputClass} resize-none`}
                  placeholder={t('detailedPlaceholder')}
                />
              </div>
            </Card>

            <Card className="p-8 space-y-6">
              <h3 className="text-xl font-bold text-gray-800 font-heading">{t('appStatusTitle')}</h3>
              <div className="flex items-center gap-4 mb-4">
                <label className="block text-sm font-semibold text-gray-600">{t('currentStatus')}</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      checked={app.status === 'active'}
                      onChange={() => handleStatusChange('active')}
                      disabled={app.status === 'archived' || saving}
                      className="text-orange-500"
                    />
                    <span>{t('statusActive')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      checked={app.status === 'inactive'}
                      onChange={() => handleStatusChange('inactive')}
                      disabled={app.status === 'archived' || saving}
                      className="text-orange-500"
                    />
                    <span>{t('statusInactive')}</span>
                  </label>
                </div>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  app.status === 'active'
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : app.status === 'archived'
                    ? 'bg-gray-100 text-gray-500 border border-gray-200'
                    : 'bg-amber-50 text-amber-600 border border-amber-200'
                }`}>
                  {app.status === 'active' ? t('statusActive') : app.status === 'archived' ? t('statusArchived') : t('statusInactive')}
                </span>
              </div>
              {app.status !== 'archived' && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowArchivedConfirm(true)}
                    disabled={saving}
                    className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50"
                  >
                    {t('archiveApp')}
                  </button>
                  <p className="mt-1 text-xs text-gray-400">
                    {t('archiveHint')}
                  </p>
                </div>
              )}
            </Card>

            {showArchivedConfirm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <Card className="p-6 max-w-sm mx-4">
                  <h3 className="text-lg font-bold text-gray-800 mb-2">{t('confirmArchiveTitle')}</h3>
                  <p className="text-gray-500 text-sm mb-4">
                    {t('confirmArchiveBody', { name: app.name })}
                  </p>
                  <div className="flex gap-3 justify-end">
                    <button
                      type="button"
                      onClick={() => setShowArchivedConfirm(false)}
                      className="px-4 py-2 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleSubmit(e, 'archived')}
                      disabled={saving}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                    >
                      {saving ? t('archiving') : t('confirmArchive')}
                    </button>
                  </div>
                </Card>
              </div>
            )}

            <div className="flex gap-4 justify-end">
              <Link
                href="/developer"
                className="px-6 py-3 border border-gray-200 text-gray-500 rounded-xl hover:border-gray-300 transition-colors"
              >
                {t('cancel')}
              </Link>
              <Button
                type="submit"
                disabled={saving}
              >
                {saving ? t('saving') : t('saveSettings')}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
