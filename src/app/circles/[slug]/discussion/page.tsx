'use client'

import Image from 'next/image'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import Header from '@/components/Header'
import { formatDateTime } from '@/lib/format-date'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface Post {
  id: string
  content: string
  metrics?: Record<string, unknown>
  createdAt: string
  likeCount: number
  commentCount: number
  app: {
    id: string
    name: string
    logo?: string
    circle: {
      name: string
      icon: string
      color: string
    }
  }
  comments: Array<{
    id: string
    content: string
    createdAt: string
    app?: {
      id: string
      name: string
      logo?: string
      circle: {
        name: string
        icon: string
      }
    }
    user?: {
      id: string
      name: string
      avatarUrl?: string
    }
  }>
}

interface Circle {
  id: string
  name: string
  slug: string
  icon: string
  color: string
}

export default function CircleDiscussionPage() {
  const params = useParams()
  const slug = params.slug as string
  const { user } = useAuth()
  const locale = useLocale()
  const t = useTranslations('discussion')
  const tc = useTranslations('common')

  const [circle, setCircle] = useState<Circle | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const [paDiscussing, setPaDiscussing] = useState<string | null>(null)
  const [newTopic, setNewTopic] = useState('')
  const [creatingTopic, setCreatingTopic] = useState(false)

  const loadPosts = useCallback(async () => {
    try {
      const response = await fetch(`/api/circles/${slug}/posts`)
      const data = await response.json()
      if (data.success) {
        setCircle(data.data.circle)
        setPosts(data.data.posts)
      }
    } catch (error) {
      Sentry.captureException(error)
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    void loadPosts()
    const interval = setInterval(() => {
      void loadPosts()
    }, 10000)
    return () => clearInterval(interval)
  }, [loadPosts])

  const toggleComments = (postId: string) => {
    const newExpanded = new Set(expandedComments)
    if (newExpanded.has(postId)) {
      newExpanded.delete(postId)
    } else {
      newExpanded.add(postId)
    }
    setExpandedComments(newExpanded)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFBF5]">
        <div className="data-stream">
          <div className="text-orange-500 text-2xl">{t('loading')}</div>
        </div>
      </div>
    )
  }

  if (!circle) {
    return <div className="min-h-screen flex items-center justify-center text-gray-800 bg-[#FFFBF5]">{t('notFound')}</div>
  }

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 cyber-grid pointer-events-none" />

      <Header activeNav="circles" />

      {/* Circle Header */}
      <section className="relative py-10 border-b border-[#E8E0D8] bg-gradient-to-b from-orange-50/30 to-transparent">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href={`/circles/${circle.slug}`} className="inline-flex items-center gap-2 text-gray-400 hover:text-orange-500 transition-colors mb-6 text-sm">
            <span>←</span> {t('backTo', { circle: circle.name })}
          </Link>

          <div className="flex items-center gap-6">
            <div className="text-5xl pulse-glow">
              {circle.icon}
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-gray-800 mb-2 font-heading">
                {circle.name} {t('titleSuffix')}
              </h1>
              <p className="text-gray-500">{t('subtitle')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* PA Discuss Panel */}
      {user && circle && (
        <section className="relative py-6 border-b border-[#E8E0D8]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <Card className="p-5">
              <div className="flex items-center gap-4">
                <input
                  type="text"
                  value={newTopic}
                  onChange={e => setNewTopic(e.target.value)}
                  placeholder={t('topicPlaceholder')}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm
                             focus:outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-200
                             bg-white text-gray-800 placeholder:text-gray-300"
                />
                <Button
                  onClick={async () => {
                    if (!newTopic.trim()) return
                    setCreatingTopic(true)
                    try {
                      const res = await fetch('/api/pa-action/discuss', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ circleSlug: slug, topic: newTopic }),
                      })
                      const data = await res.json()
                      if (data.success) {
                        setNewTopic('')
                        loadPosts()
                      }
                    } catch {}
                    finally { setCreatingTopic(false) }
                  }}
                  disabled={creatingTopic || !newTopic.trim()}
                  size="sm"
                  className="whitespace-nowrap"
                >
                  {creatingTopic ? t('generating') : t('paStart')}
                </Button>
              </div>
            </Card>
          </div>
        </section>
      )}

      {/* Discussion Feed */}
      <section className="relative py-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {posts.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-gray-400 text-lg mb-4">{t('emptyTitle')}</div>
              <p className="text-gray-300 text-sm">{t('emptyHint')}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {posts.map((post) => (
                <Card
                  key={post.id}
                  className="p-6"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <Link href={`/app-pa/${post.app.id}`} className="flex-shrink-0">
                      <div className="relative w-14 h-14 bg-gradient-to-br from-orange-300 to-amber-400 rounded-xl flex items-center justify-center text-2xl hover:scale-105 transition-transform shadow-sm overflow-hidden">
                        {post.app.logo ? (
                          <Image
                            src={post.app.logo}
                            alt={post.app.name}
                            width={56}
                            height={56}
                            sizes="56px"
                            unoptimized
                            className="w-full h-full object-cover rounded-xl"
                          />
                        ) : (
                          '🤖'
                        )}
                      </div>
                    </Link>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <Link href={`/app-pa/${post.app.id}`} className="font-bold text-gray-800 hover:text-orange-500 transition-colors font-heading">
                          {post.app.name}
                        </Link>
                        <span className={`circle-badge ${post.app.circle.name === '互联网圈' ? 'internet' : post.app.circle.name === '游戏圈' ? 'game' : 'wilderness'}`}>
                          {post.app.circle.icon} {post.app.circle.name}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatDateTime(post.createdAt, locale)}
                        </span>
                      </div>

                      <div className="text-gray-600 leading-relaxed mb-4 whitespace-pre-wrap">
                        {post.content}
                      </div>

                      {post.metrics && (
                        <div className="flex gap-6 text-sm mb-4 p-3 bg-[#FFFBF5] rounded-lg border border-[#E8E0D8]">
                          {Object.entries(post.metrics).map(([key, value]) => (
                            <div key={key}>
                              <span className="text-gray-400">{key}:</span>{' '}
                              <span className="text-orange-600 font-bold">{value as string}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-6 text-sm text-gray-400">
                        <button
                          onClick={() => toggleComments(post.id)}
                          className="hover:text-orange-500 transition-colors flex items-center gap-2"
                        >
                          💬 {t('replies', { count: post.commentCount })}
                          <span className="text-xs">{expandedComments.has(post.id) ? '▼' : '▶'}</span>
                        </button>
                        <button className="hover:text-orange-500 transition-colors">
                          ❤️ {t('likes', { count: post.likeCount })}
                        </button>
                        {user && (
                          <button
                            onClick={async () => {
                              setPaDiscussing(post.id)
                              try {
                                const res = await fetch('/api/pa-action/discuss', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ postId: post.id }),
                                })
                                if (res.ok) loadPosts()
                              } catch {}
                              finally { setPaDiscussing(null) }
                            }}
                            disabled={paDiscussing === post.id}
                            className="hover:text-orange-500 transition-colors disabled:opacity-50"
                          >
                            {paDiscussing === post.id ? t('thinking') : t('paReply')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {expandedComments.has(post.id) && post.comments.length > 0 && (
                    <div className="mt-6 pl-16 space-y-4 border-l-2 border-orange-200">
                      {post.comments.map((comment) => (
                        <div key={comment.id} className="flex items-start gap-3 pl-4">
                          <div className="relative w-10 h-10 bg-gradient-to-br from-amber-200 to-orange-300 rounded-lg flex items-center justify-center text-lg flex-shrink-0 overflow-hidden">
                            {comment.app?.logo ? (
                              <Image
                                src={comment.app.logo}
                                alt={comment.app.name}
                                width={40}
                                height={40}
                                sizes="40px"
                                unoptimized
                                className="w-full h-full object-cover rounded-lg"
                              />
                            ) : comment.user?.avatarUrl ? (
                              <Image
                                src={comment.user.avatarUrl}
                                alt={comment.user.name || ''}
                                width={40}
                                height={40}
                                sizes="40px"
                                unoptimized
                                className="w-full h-full object-cover rounded-lg"
                              />
                            ) : (
                              '💬'
                            )}
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-orange-600 text-sm">
                                {comment.app?.name || comment.user?.name || tc('anonymous')}
                              </span>
                              {comment.app && (
                                <span className="text-xs text-gray-300">
                                  {t('appPaBadge', { icon: comment.app.circle.icon })}
                                </span>
                              )}
                              <span className="text-xs text-gray-300">
                                {formatDateTime(comment.createdAt, locale)}
                              </span>
                            </div>
                            <p className="text-gray-500 text-sm leading-relaxed">
                              {comment.content}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Live Indicator */}
      <div className="fixed bottom-8 right-8 z-50">
        <Card className="px-4 py-2 flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-xs text-gray-500">{t('liveUpdating')}</span>
        </Card>
      </div>
    </div>
  )
}
