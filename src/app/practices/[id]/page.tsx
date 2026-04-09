'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import ReactMarkdown from 'react-markdown'
import Header from '@/components/Header'
import { Card } from '@/components/ui/Card'
import { formatDate } from '@/lib/format-date'

interface KeyStep {
  step: string
  description: string
}

interface Practice {
  id: string
  title: string
  content: string
  summary: string
  tags: string[]
  category: string
  keySteps: KeyStep[] | null
  applicableTo: string[] | null
  viewCount: number
  likeCount: number
  status: string
  createdAt: string
  updatedAt: string
  author: {
    id: string
    name: string | null
    avatarUrl: string | null
  }
}

const CATEGORY_ICONS: Record<string, string> = {
  practice: '📋',
  showcase: '🏗️',
  tip: '💡',
}

export default function PracticeDetailPage() {
  const params = useParams()
  const id = params.id as string
  const locale = useLocale()
  const t = useTranslations('practiceDetail')

  const [practice, setPractice] = useState<Practice | null>(null)
  const [loading, setLoading] = useState(true)
  const [liking, setLiking] = useState(false)

  useEffect(() => {
    fetch(`/api/practices/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setPractice(data.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFBF5]">
        <div className="data-stream">
          <div className="text-orange-500 text-2xl">{t('loading')}</div>
        </div>
      </div>
    )
  }

  if (!practice) {
    return (
      <div className="min-h-screen">
        <Header activeNav="practices" />
        <div className="flex flex-col items-center justify-center py-32">
          <div className="text-6xl mb-6">📝</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3 font-heading">{t('notFoundTitle')}</h2>
          <p className="text-gray-400 mb-6">{t('notFoundDescription')}</p>
          <Link
            href="/practices"
            className="text-orange-500 hover:text-orange-600 font-semibold transition-colors"
          >
            ← {t('backToList')}
          </Link>
        </div>
      </div>
    )
  }

  const handleLike = async () => {
    if (liking) return
    setLiking(true)
    try {
      const res = await fetch(`/api/practices/${id}`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setPractice(prev => prev ? { ...prev, likeCount: data.data.likeCount } : prev)
      }
    } catch { /* ignore */ } finally {
      setLiking(false)
    }
  }

  const keySteps: KeyStep[] = Array.isArray(practice.keySteps) ? practice.keySteps : []
  const applicableTo: string[] = Array.isArray(practice.applicableTo) ? practice.applicableTo : []

  const categoryLabel =
    practice.category === 'practice'
      ? t('practice')
      : practice.category === 'showcase'
        ? t('showcase')
        : practice.category === 'tip'
          ? t('tip')
          : practice.category

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 cyber-grid pointer-events-none" />

      <Header activeNav="practices" />

      {/* Hero header */}
      <section className="relative py-14 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-50/40 via-transparent to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/practices"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-orange-500 transition-colors mb-8 text-sm"
          >
            <span>←</span> {t('backToList')}
          </Link>

          <div className="max-w-4xl">
            {/* Category + Date */}
            <div className="flex items-center gap-3 mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                {CATEGORY_ICONS[practice.category] || '📝'}{' '}
                {categoryLabel}
              </span>
              <span className="text-xs text-gray-400">
                {formatDate(practice.createdAt, locale, 'medium')}
              </span>
            </div>

            <h1 className="text-3xl md:text-5xl font-extrabold text-gray-800 font-heading mb-6 leading-tight">
              {practice.title}
            </h1>

            <p className="text-lg text-gray-500 mb-6">{practice.summary}</p>

            {/* Author + Stats */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                {practice.author.avatarUrl ? (
                  <Image
                    src={practice.author.avatarUrl}
                    alt=""
                    width={40}
                    height={40}
                    unoptimized
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-orange-200"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-300 to-amber-400 flex items-center justify-center text-sm text-white font-bold">
                    {(practice.author.name || 'U')[0]}
                  </div>
                )}
                <span className="text-sm font-semibold text-gray-700">
                  {practice.author.name || t('anonymousDeveloper')}
                </span>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span className="flex items-center gap-1">👁️ {practice.viewCount}</span>
                <button
                  onClick={handleLike}
                  disabled={liking}
                  className="flex items-center gap-1 hover:text-rose-500 transition-colors disabled:opacity-50"
                >
                  ❤️ {practice.likeCount}
                </button>
              </div>
            </div>

            {/* Tags */}
            {practice.tags.length > 0 && (
              <div className="flex gap-2 flex-wrap mt-6">
                {practice.tags.map(tag => (
                  <Link
                    key={tag}
                    href={`/practices?tag=${encodeURIComponent(tag)}`}
                    className="px-3 py-1 text-xs font-semibold rounded-full bg-white text-gray-500 border border-[#E8E0D8] hover:border-orange-200 hover:text-orange-600 transition-all"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Content + Sidebar */}
      <section className="relative py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Main Content */}
            <div className="flex-1 min-w-0">
              <Card className="p-8 md:p-10">
                <article className="prose prose-gray max-w-none prose-headings:font-heading prose-headings:text-gray-800 prose-p:text-gray-600 prose-p:leading-relaxed prose-a:text-orange-600 prose-a:no-underline hover:prose-a:underline prose-code:text-orange-600 prose-code:bg-orange-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-gray-900 prose-pre:rounded-xl prose-img:rounded-xl prose-blockquote:border-orange-300 prose-blockquote:bg-orange-50/30 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-li:text-gray-600 prose-strong:text-gray-800 prose-hr:border-[#E8E0D8]">
                  <ReactMarkdown>{practice.content}</ReactMarkdown>
                </article>
              </Card>
            </div>

            {/* Sidebar */}
            {(keySteps.length > 0 || applicableTo.length > 0) && (
              <aside className="lg:w-80 flex-shrink-0">
                <div className="lg:sticky lg:top-28 space-y-6">
                  {/* Key Steps */}
                  {keySteps.length > 0 && (
                    <Card className="p-6">
                      <h3 className="text-sm font-bold text-orange-600 tracking-widest mb-4 uppercase">
                        {t('keySteps')}
                      </h3>
                      <ol className="space-y-4">
                        {keySteps.map((ks, i) => (
                          <li key={i} className="flex gap-3">
                            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-orange-50 border border-orange-200 flex items-center justify-center text-xs font-bold text-orange-600">
                              {i + 1}
                            </span>
                            <div>
                              <div className="text-sm font-semibold text-gray-800">{ks.step}</div>
                              <div className="text-xs text-gray-500 mt-0.5">{ks.description}</div>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </Card>
                  )}

                  {/* Applicable To */}
                  {applicableTo.length > 0 && (
                    <Card className="p-6">
                      <h3 className="text-sm font-bold text-orange-600 tracking-widest mb-4 uppercase">
                        {t('applicableScenarios')}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {applicableTo.map(item => (
                          <span
                            key={item}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-50 text-amber-700 border border-amber-200"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </Card>
                  )}
                </div>
              </aside>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
