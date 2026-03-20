'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

interface HeaderProps {
  activeNav?: 'home' | 'portal' | 'circles' | 'leaderboard' | 'hall-of-fame' | 'pa-directory' | 'developer' | 'my-reviews' | 'pa-activity'
}

export default function Header({ activeNav = 'home' }: HeaderProps) {
  const router = useRouter()
  const { user, mutate } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [becomingDev, setBecomingDev] = useState(false)
  const [points, setPoints] = useState<number | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (user) {
      fetch('/api/points/balance')
        .then(r => r.json())
        .then(d => { if (d.success) setPoints(d.data.balance) })
        .catch(() => {})
    }
  }, [user])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setMenuOpen(false)
    await mutate()
    router.refresh()
  }

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
        setMenuOpen(false)
        await mutate()
        router.push('/developer')
      }
    } catch { /* ignore */ } finally {
      setBecomingDev(false)
    }
  }

  const navItems = [
    { key: 'home', label: '首页', href: '/' },
    { key: 'portal', label: '门户', href: '/portal' },
    { key: 'circles', label: '赛道', href: '/circles' },
    { key: 'leaderboard', label: '排行榜', href: '/leaderboard' },
    { key: 'hall-of-fame', label: '名人墙', href: '/hall-of-fame' },
    { key: 'pa-directory', label: 'PA通讯录', href: '/pa-directory' },
    { key: 'developer', label: '开发者', href: '/developer' },
    ...(user ? [
      { key: 'my-reviews' as const, label: '我的评价', href: '/my-reviews' },
      { key: 'pa-activity' as const, label: 'PA 动态', href: '/pa-activity' },
    ] : []),
  ]

  const navClass = (key: string) =>
    key === activeNav
      ? 'text-orange-600 font-semibold text-sm tracking-wide hover:text-orange-500 transition-colors'
      : 'text-gray-500 font-semibold text-sm tracking-wide hover:text-orange-500 transition-colors'

  return (
    <header className="relative border-b border-[#E8E0D8] backdrop-blur-md bg-white/90 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <Link href="/" className="flex items-center gap-4 group">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-xl font-body">A2A</span>
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800 font-heading">A2A 智选报社</h1>
              <p className="text-xs text-orange-500 tracking-widest font-body">HUMAN SPACE · AGENT SPACE</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {navItems.map(item => (
              <Link key={item.key} href={item.href} className={navClass(item.key)}>
                {item.label}
              </Link>
            ))}
          </nav>

          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(prev => !prev)}
                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-orange-50 transition-colors"
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name || ''}
                    className="w-9 h-9 rounded-full object-cover ring-2 ring-orange-200"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center">
                    <span className="text-white text-sm font-bold">
                      {(user.name || 'U')[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="text-sm font-semibold text-gray-700 hidden sm:block max-w-[120px] truncate">
                  {user.name || user.email || 'User'}
                </span>
                {points !== null && points > 0 && (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-full text-xs text-amber-600 font-semibold">
                    {points}
                  </span>
                )}
                {points !== null && points > 0 && (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-full text-xs font-bold text-amber-600">
                    {points} pt
                  </span>
                )}
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-[#E8E0D8] py-2 z-50">
                  <div className="px-4 py-3 border-b border-[#E8E0D8]">
                    <p className="text-sm font-semibold text-gray-800 truncate">{user.name || 'User'}</p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>

                  {user.isDeveloper ? (
                    <Link
                      href="/developer"
                      onClick={() => setMenuOpen(false)}
                      className="block px-4 py-2.5 text-sm text-gray-600 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                    >
                      开发者空间
                    </Link>
                  ) : (
                    <button
                      onClick={handleBecomeDeveloper}
                      disabled={becomingDev}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:bg-orange-50 hover:text-orange-600 transition-colors disabled:opacity-50"
                    >
                      {becomingDev ? '开通中...' : '我是开发者'}
                    </button>
                  )}

                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:bg-red-50 hover:text-red-500 transition-colors"
                  >
                    退出登录
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Button asChild size="sm">
              <Link href="/api/auth/login">登录</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
