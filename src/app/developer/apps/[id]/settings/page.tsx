'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/Header'
import { useAuth } from '@/contexts/AuthContext'

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
          setError(data.error || 'Failed to load app')
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Network error')
        setLoading(false)
      })
  }, [appId, user, authLoading])

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
        setSuccess('状态已更新')
        setApp(data.data)
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(data.error || '更新失败')
      }
    } catch {
      setError('网络错误')
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
        setSuccess(statusOverride === 'archived' ? '已归档' : '保存成功')
        setApp(data.data)
        setShowArchivedConfirm(false)
        if (statusOverride === 'archived') {
          setTimeout(() => router.push('/developer'), 1500)
        } else {
          setTimeout(() => setSuccess(''), 3000)
        }
      } else {
        setError(data.error || '保存失败')
      }
    } catch {
      setError('网络错误')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) {
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
          <p className="text-gray-500 text-lg">请先登录</p>
          <Link href="/api/auth/login" className="cyber-btn text-sm">登录</Link>
        </div>
      </div>
    )
  }

  if (!app) {
    return (
      <div className="min-h-screen">
        <Header activeNav="developer" />
        <div className="flex flex-col items-center justify-center py-32 gap-6">
          <p className="text-gray-500 text-lg">{error || '应用不存在'}</p>
          <Link href="/developer" className="cyber-btn text-sm">返回面板</Link>
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
              &larr; 返回面板
            </Link>
            <h2 className="text-3xl font-extrabold text-gray-800 mb-2 font-heading">
              应用设置
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

            <div className="cyber-card p-8 space-y-6">
              <h3 className="text-xl font-bold text-gray-800 font-heading">基本信息</h3>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">应用名称</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">一句话介绍</label>
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
                <label className="block text-sm font-semibold text-gray-600 mb-2">SecondMe Client ID</label>
                <input
                  type="text"
                  value={form.clientId}
                  onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
                  className={`${inputClass} font-mono text-sm`}
                  placeholder="526d9920-c43c-4512-917d-5f59f706f087"
                />
                <p className="mt-1 text-xs text-gray-400">
                  在 SecondMe 开发者平台获取的应用唯一标识
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">无障碍支持</label>
                <select
                  value={form.accessibility}
                  onChange={e => setForm(f => ({ ...f, accessibility: e.target.value }))}
                  className={inputClass}
                >
                  <option value="none">无特殊支持</option>
                  <option value="partial">部分支持</option>
                  <option value="full">完全支持</option>
                </select>
              </div>
            </div>

            <div className="cyber-card p-8 space-y-6">
              <h3 className="text-xl font-bold text-gray-800 font-heading">链接信息</h3>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">封面图片 URL</label>
                <input
                  type="url"
                  value={form.coverImage}
                  onChange={e => setForm(f => ({ ...f, coverImage: e.target.value }))}
                  className={inputClass}
                  placeholder="https://example.com/cover.png"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">作品链接</label>
                <input
                  type="url"
                  value={form.projectUrl}
                  onChange={e => setForm(f => ({ ...f, projectUrl: e.target.value }))}
                  className={inputClass}
                  placeholder="https://your-app.com"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">GitHub 链接</label>
                <input
                  type="url"
                  value={form.githubUrl}
                  onChange={e => setForm(f => ({ ...f, githubUrl: e.target.value }))}
                  className={inputClass}
                  placeholder="https://github.com/username/repo"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">视频链接</label>
                <input
                  type="url"
                  value={form.videoUrl}
                  onChange={e => setForm(f => ({ ...f, videoUrl: e.target.value }))}
                  className={inputClass}
                  placeholder="https://youtube.com/watch?v=..."
                />
              </div>
            </div>

            <div className="cyber-card p-8 space-y-6">
              <h3 className="text-xl font-bold text-gray-800 font-heading">详细描述</h3>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  项目详情（支持 Markdown）
                </label>
                <textarea
                  value={form.detailedDescription}
                  onChange={e => setForm(f => ({ ...f, detailedDescription: e.target.value }))}
                  rows={10}
                  className={`${inputClass} resize-none`}
                  placeholder="详细描述你的项目..."
                />
              </div>
            </div>

            <div className="cyber-card p-8 space-y-6">
              <h3 className="text-xl font-bold text-gray-800 font-heading">应用状态</h3>
              <div className="flex items-center gap-4 mb-4">
                <label className="block text-sm font-semibold text-gray-600">当前状态</label>
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
                    <span>活跃</span>
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
                    <span>暂停</span>
                  </label>
                </div>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  app.status === 'active'
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : app.status === 'archived'
                    ? 'bg-gray-100 text-gray-500 border border-gray-200'
                    : 'bg-amber-50 text-amber-600 border border-amber-200'
                }`}>
                  {app.status === 'active' ? '活跃' : app.status === 'archived' ? '已归档' : '暂停'}
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
                    归档应用
                  </button>
                  <p className="mt-1 text-xs text-gray-400">
                    归档后不可恢复，应用将不再显示在列表中
                  </p>
                </div>
              )}
            </div>

            {showArchivedConfirm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="cyber-card p-6 max-w-sm mx-4">
                  <h3 className="text-lg font-bold text-gray-800 mb-2">确认归档</h3>
                  <p className="text-gray-500 text-sm mb-4">
                    归档后应用将无法恢复为活跃或暂停状态，确定要归档「{app.name}」吗？
                  </p>
                  <div className="flex gap-3 justify-end">
                    <button
                      type="button"
                      onClick={() => setShowArchivedConfirm(false)}
                      className="px-4 py-2 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleSubmit(e, 'archived')}
                      disabled={saving}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                    >
                      {saving ? '归档中...' : '确认归档'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-4 justify-end">
              <Link
                href="/developer"
                className="px-6 py-3 border border-gray-200 text-gray-500 rounded-xl hover:border-gray-300 transition-colors"
              >
                取消
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="cyber-btn disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存设置'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
