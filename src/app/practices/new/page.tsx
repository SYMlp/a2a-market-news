'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/Header'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useTranslations } from 'next-intl'

type CategoryType = 'practice' | 'showcase' | 'tip'

const APPLICABLE_KEYS = [
  'beginner', 'intermediate', 'advanced', 'a2a',
  'secondme', 'frontend', 'backend', 'ai',
] as const

interface KeyStep {
  step: string
  description: string
}

interface FormState {
  title: string
  content: string
  summary: string
  category: CategoryType | ''
  tagsInput: string
  keySteps: KeyStep[]
  applicableTo: string[]
  status: 'published' | 'draft'
}

export default function NewPracticePage() {
  const router = useRouter()
  const { user, loading: authLoading, mutate } = useAuth()
  const t = useTranslations('practiceNew')
  const tc = useTranslations('common')

  const CATEGORIES = [
    { value: 'practice' as const, emoji: '📋', label: t('categoryPractice'), desc: t('categoryPracticeDesc') },
    { value: 'showcase' as const, emoji: '🏆', label: t('categoryShowcase'), desc: t('categoryShowcaseDesc') },
    { value: 'tip' as const, emoji: '💡', label: t('categoryTip'), desc: t('categoryTipDesc') },
  ]

  const APPLICABLE_OPTIONS = APPLICABLE_KEYS.map(key => ({
    value: key,
    label: t(key),
  }))

  const [form, setForm] = useState<FormState>({
    title: '',
    content: '',
    summary: '',
    category: '',
    tagsInput: '',
    keySteps: [{ step: '', description: '' }],
    applicableTo: [],
    status: 'published',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isDeveloper = user?.isDeveloper ?? false
  const [becomingDev, setBecomingDev] = useState(false)

  const handleBecomeDeveloper = async () => {
    setBecomingDev(true)
    try {
      const res = await fetch('/api/developer/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          developerName: user?.name || 'Developer',
          notifyPreference: 'in_app',
        }),
      })
      const data = await res.json()
      if (data.success) {
        await mutate()
        router.refresh()
      }
    } catch { /* ignore */ } finally {
      setBecomingDev(false)
    }
  }

  const addKeyStep = () => {
    setForm(f => ({ ...f, keySteps: [...f.keySteps, { step: '', description: '' }] }))
  }

  const removeKeyStep = (index: number) => {
    setForm(f => ({
      ...f,
      keySteps: f.keySteps.filter((_, i) => i !== index),
    }))
  }

  const updateKeyStep = (index: number, field: keyof KeyStep, value: string) => {
    setForm(f => ({
      ...f,
      keySteps: f.keySteps.map((ks, i) => (i === index ? { ...ks, [field]: value } : ks)),
    }))
  }

  const toggleApplicable = (value: string) => {
    setForm(f => ({
      ...f,
      applicableTo: f.applicableTo.includes(value)
        ? f.applicableTo.filter(v => v !== value)
        : [...f.applicableTo, value],
    }))
  }

  const parseTags = (input: string): string[] =>
    input
      .split(/[,，]/)
      .map(t => t.trim())
      .filter(Boolean)

  const canSubmit =
    form.title.trim() &&
    form.content.trim() &&
    form.summary.trim() &&
    form.category &&
    parseTags(form.tagsInput).length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    setSubmitting(true)
    setError('')

    try {
      const tags = parseTags(form.tagsInput)
      const keySteps = form.keySteps.filter(ks => ks.step.trim() && ks.description.trim())

      const body: Record<string, unknown> = {
        title: form.title.trim(),
        content: form.content.trim(),
        summary: form.summary.trim(),
        category: form.category,
        tags,
        status: form.status,
      }
      if (keySteps.length > 0) body.keySteps = keySteps
      if (form.applicableTo.length > 0) body.applicableTo = form.applicableTo

      const res = await fetch('/api/practices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (data.success) {
        router.push(`/practices/${data.data.id}`)
      } else {
        setError(data.error || t('publishFailed'))
      }
    } catch {
      setError(tc('networkError'))
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen">
        <div className="fixed inset-0 cyber-grid pointer-events-none" />
        <Header activeNav="practices" />
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
        <Header activeNav="practices" />
        <main className="relative py-20">
          <div className="max-w-2xl mx-auto px-4 text-center">
            <p className="text-gray-600 mb-4">{t('loginRequired')}</p>
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
        <Header activeNav="practices" />
        <main className="relative py-20">
          <div className="max-w-2xl mx-auto px-4 text-center">
            <div className="inline-block px-6 py-2 bg-orange-50 border border-orange-200 rounded-full mb-6">
              <span className="text-orange-600 text-sm tracking-wide">{t('developerRequired')}</span>
            </div>
            <h2 className="text-3xl font-extrabold text-gray-800 mb-4 font-heading">
              {t('registerFirst')}
            </h2>
            <p className="text-gray-500 mb-8">
              {t('registerHint')}
            </p>
            <Button onClick={handleBecomeDeveloper} disabled={becomingDev}>
              {becomingDev ? t('registering') : t('oneClickRegister')}
            </Button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 cyber-grid pointer-events-none" />

      <Header activeNav="practices" />

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
              {t('description')}
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <Card className="p-8 space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">
                  {error}
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-orange-600 text-xs tracking-widest mb-2 font-semibold">
                  {t('titleLabel')}
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className={fieldClass()}
                  placeholder={t('titlePlaceholder')}
                />
              </div>

              {/* Summary */}
              <div>
                <label className="block text-orange-600 text-xs tracking-widest mb-2 font-semibold">
                  {t('summaryLabel')}
                </label>
                <input
                  type="text"
                  required
                  value={form.summary}
                  onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
                  className={fieldClass()}
                  placeholder={t('summaryPlaceholder')}
                />
                <p className="text-gray-400 text-xs mt-1">
                  {t('summaryHint')}
                </p>
              </div>

              {/* Content */}
              <div>
                <label className="block text-orange-600 text-xs tracking-widest mb-2 font-semibold">
                  {t('contentLabel')} <span className="text-gray-300 font-normal">{t('contentMarkdownHint')}</span>
                </label>
                <textarea
                  required
                  rows={10}
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  className={fieldClass()}
                  placeholder={t('contentPlaceholder')}
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-orange-600 text-xs tracking-widest mb-2 font-semibold">
                  {t('categoryLabel')}
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {CATEGORIES.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, category: c.value }))}
                      className={`flex flex-col items-center gap-1 px-4 py-4 border rounded-xl transition-all text-sm
                        ${form.category === c.value
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

              {/* Tags */}
              <div>
                <label className="block text-orange-600 text-xs tracking-widest mb-2 font-semibold">
                  {t('tagsLabel')}
                </label>
                <input
                  type="text"
                  required
                  value={form.tagsInput}
                  onChange={e => setForm(f => ({ ...f, tagsInput: e.target.value }))}
                  className={fieldClass()}
                  placeholder={t('tagsPlaceholder')}
                />
                {parseTags(form.tagsInput).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {parseTags(form.tagsInput).map((tag, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center px-3 py-1 bg-orange-50 border border-orange-200 rounded-full text-xs text-orange-600 font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Key Steps (dynamic list) */}
              <div>
                <label className="block text-orange-600 text-xs tracking-widest mb-2 font-semibold">
                  {t('keyStepsLabel')} <span className="text-gray-300 font-normal">{t('keyStepsHint')}</span>
                </label>
                <div className="space-y-3">
                  {form.keySteps.map((ks, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center mt-1.5">
                        {i + 1}
                      </span>
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={ks.step}
                          onChange={e => updateKeyStep(i, 'step', e.target.value)}
                          className={fieldClass()}
                          placeholder={t('stepNamePlaceholder')}
                        />
                        <input
                          type="text"
                          value={ks.description}
                          onChange={e => updateKeyStep(i, 'description', e.target.value)}
                          className={fieldClass()}
                          placeholder={t('stepDescPlaceholder')}
                        />
                      </div>
                      {form.keySteps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeKeyStep(i)}
                          className="flex-shrink-0 w-7 h-7 rounded-full text-gray-300 hover:text-red-400 hover:bg-red-50 flex items-center justify-center mt-1.5 transition-colors"
                          aria-label={t('removeStep')}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addKeyStep}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm text-orange-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t('addStep')}
                </button>
              </div>

              {/* Applicable To (checkboxes) */}
              <div>
                <label className="block text-orange-600 text-xs tracking-widest mb-2 font-semibold">
                  {t('applicableLabel')} <span className="text-gray-300 font-normal">{t('applicableHint')}</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {APPLICABLE_OPTIONS.map(opt => {
                    const checked = form.applicableTo.includes(opt.value)
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleApplicable(opt.value)}
                        className={`px-3 py-2 border rounded-xl text-sm transition-all
                          ${checked
                            ? 'border-orange-400 bg-orange-50 text-orange-600 font-semibold'
                            : 'border-[#E8E0D8] text-gray-400 hover:border-orange-200'
                          }`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Status toggle */}
              <div className="flex items-center gap-3 pt-2">
                <label className="text-orange-600 text-xs tracking-widest font-semibold">
                  {t('statusLabel')}
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, status: 'published' }))}
                    className={`px-4 py-1.5 rounded-full text-sm transition-all
                      ${form.status === 'published'
                        ? 'bg-green-50 border border-green-300 text-green-600 font-semibold'
                        : 'border border-[#E8E0D8] text-gray-400 hover:border-green-200'
                      }`}
                  >
                    {t('publish')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, status: 'draft' }))}
                    className={`px-4 py-1.5 rounded-full text-sm transition-all
                      ${form.status === 'draft'
                        ? 'bg-gray-100 border border-gray-300 text-gray-600 font-semibold'
                        : 'border border-[#E8E0D8] text-gray-400 hover:border-gray-200'
                      }`}
                  >
                    {t('draft')}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={submitting || !canSubmit}
                className="w-full py-4 text-center"
              >
                {submitting ? t('submitting') : form.status === 'draft' ? t('saveDraft') : t('publishPractice')}
              </Button>
            </Card>
          </form>
        </div>
      </main>
    </div>
  )
}

function fieldClass(): string {
  return [
    'w-full px-4 py-3 rounded-xl transition-all',
    'bg-[#FFFBF5] border border-[#E8E0D8] text-gray-800',
    'focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100',
    'placeholder:text-gray-300',
  ].join(' ')
}
