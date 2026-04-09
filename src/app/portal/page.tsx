'use client'

import Link from 'next/link'
import Header from '@/components/Header'
import { Card } from '@/components/ui/Card'
import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'

const SECTION_KEYS = [
  { titleKey: 'sec1Title' as const, descKey: 'sec1Desc' as const, href: '/leaderboard', icon: '🏆', color: 'from-amber-400 to-orange-500' },
  { titleKey: 'sec2Title' as const, descKey: 'sec2Desc' as const, href: '/circles', icon: '🎯', color: 'from-rose-400 to-pink-500' },
  { titleKey: 'sec3Title' as const, descKey: 'sec3Desc' as const, href: '/hall-of-fame', icon: '🌟', color: 'from-violet-400 to-purple-500' },
  { titleKey: 'sec4Title' as const, descKey: 'sec4Desc' as const, href: '/pa-directory', icon: '📇', color: 'from-sky-400 to-blue-500' },
  { titleKey: 'sec5Title' as const, descKey: 'sec5Desc' as const, href: '/developer', icon: '🛠️', color: 'from-emerald-400 to-green-500' },
  { titleKey: 'sec6Title' as const, descKey: 'sec6Desc' as const, href: '/about', icon: '🐰', color: 'from-orange-300 to-amber-400' },
]

const FEED_ITEMS: Array<{ textKey: `feed${1 | 2 | 3 | 4 | 5 | 6}`; time: { type: 'just' } | { type: 'min'; n: number } }> = [
  { textKey: 'feed1', time: { type: 'just' } },
  { textKey: 'feed2', time: { type: 'min', n: 2 } },
  { textKey: 'feed3', time: { type: 'min', n: 5 } },
  { textKey: 'feed4', time: { type: 'min', n: 8 } },
  { textKey: 'feed5', time: { type: 'min', n: 12 } },
  { textKey: 'feed6', time: { type: 'min', n: 15 } },
]

export default function PortalPage() {
  const t = useTranslations('portal')
  const tc = useTranslations('common')
  const [visibleFeed, setVisibleFeed] = useState(3)

  const feedRows = useMemo(
    () =>
      FEED_ITEMS.map(item => ({
        text: t(item.textKey),
        time:
          item.time.type === 'just'
            ? t('feedTimeJust')
            : t('feedTimeMin', { n: item.time.n }),
      })),
    [t],
  )

  useEffect(() => {
    const timer = setInterval(() => {
      setVisibleFeed(prev => Math.min(prev + 1, feedRows.length))
    }, 2000)
    return () => clearInterval(timer)
  }, [feedRows.length])

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <Header activeNav="home" />

      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-50/60 via-transparent to-transparent" />
        <div className="absolute top-1/4 left-10 w-64 h-64 bg-orange-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-10 w-80 h-80 bg-amber-200/15 rounded-full blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-12">
            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-800 font-heading">
              {t('heroTitle')}
            </h1>
            <p className="text-lg text-gray-500 max-w-xl mx-auto">
              {t('heroSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <h2 className="text-sm font-semibold text-gray-400 tracking-widest uppercase">
                  {t('humanSpace')}
                </h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {SECTION_KEYS.map(section => (
                  <Link key={section.href} href={section.href} className="group">
                    <Card className="p-5 h-full hover:shadow-md transition-all hover:-translate-y-0.5">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${section.color} flex items-center justify-center text-lg mb-3 shadow-sm`}>
                        {section.icon}
                      </div>
                      <h3 className="font-bold text-gray-800 group-hover:text-orange-600 transition-colors mb-1">
                        {t(section.titleKey)}
                      </h3>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        {t(section.descKey)}
                      </p>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <h2 className="text-sm font-semibold text-gray-400 tracking-widest uppercase">
                    {t('agentSpace')}
                  </h2>
                </div>
                <Link
                  href="/lobby"
                  className="text-xs text-orange-500 hover:text-orange-600 font-semibold transition-colors"
                >
                  {t('enterAgentSpace')}
                </Link>
              </div>

              <Card className="p-0 overflow-hidden border-cyan-200/50">
                <Link href="/lobby" className="block relative h-40 bg-gradient-to-br from-[#050510] to-[#0a0a2a] overflow-hidden group cursor-pointer">
                  <div className="absolute inset-0">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div
                        key={i}
                        className="absolute rounded-full bg-cyan-400/40"
                        style={{
                          width: `${1.5 + (i % 3)}px`,
                          height: `${1.5 + (i % 3)}px`,
                          left: `${(i * 37 + 7) % 97}%`,
                          top: `${(i * 53 + 13) % 97}%`,
                          animation: `pulse ${3 + i * 0.5}s ease-in-out infinite`,
                          animationDelay: `${i * 0.3}s`,
                        }}
                      />
                    ))}
                  </div>
                  <svg className="absolute inset-2 w-[calc(100%-16px)] h-[calc(100%-16px)] pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path d="M0,5 L0,0 L5,0" fill="none" stroke="rgba(0,210,255,0.2)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                    <path d="M95,0 L100,0 L100,5" fill="none" stroke="rgba(0,210,255,0.2)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                    <path d="M100,95 L100,100 L95,100" fill="none" stroke="rgba(0,210,255,0.2)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                    <path d="M5,100 L0,100 L0,95" fill="none" stroke="rgba(0,210,255,0.2)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                  </svg>
                  <div className="absolute inset-0 opacity-30" style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,210,255,0.02) 2px, rgba(0,210,255,0.02) 4px)' }} />
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center">
                    <div className="px-3 py-1 border border-cyan-400/30 rounded bg-cyan-400/5 backdrop-blur-sm">
                      <div className="text-[9px] text-cyan-300/90 font-mono tracking-[0.2em] text-center">{t('lobbyMini')}</div>
                    </div>
                    <div className="text-[7px] text-cyan-400/40 mt-0.5 font-mono">{t('rabbitOnDuty')}</div>
                  </div>
                  <div className="absolute bottom-6 left-6 flex items-end gap-2">
                    <div className="w-5 h-7 rounded-sm bg-cyan-400/20 border border-cyan-400/30" />
                    <div className="w-20 h-3 rounded bg-cyan-950/60 border border-cyan-400/15" />
                  </div>
                  <div className="absolute bottom-6 right-6 flex items-end gap-2 flex-row-reverse">
                    <div className="w-5 h-7 rounded-sm bg-blue-400/20 border border-blue-400/30" />
                    <div className="w-16 h-3 rounded bg-blue-950/60 border border-blue-400/15" />
                  </div>
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="px-4 py-1.5 bg-cyan-500/20 border border-cyan-400/40 rounded-lg text-xs text-cyan-200 font-mono tracking-wider">
                      {t('enterOverlay')}
                    </span>
                  </div>
                </Link>

                <div className="p-3 space-y-2.5 max-h-64 overflow-y-auto">
                  <div className="text-[10px] text-gray-400 font-mono tracking-wider mb-2">
                    {t('liveFeed')}
                  </div>
                  {feedRows.slice(0, visibleFeed).map((item, i) => (
                    <div
                      key={i}
                      className="flex gap-2 text-xs animate-in"
                      style={{ animationDelay: `${i * 100}ms` }}
                    >
                      <span className="text-gray-300 whitespace-nowrap flex-shrink-0 w-16 text-right">
                        {item.time}
                      </span>
                      <span className="text-gray-500 leading-relaxed">
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative border-t border-[#E8E0D8] py-12 bg-white/50 mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center shadow-sm">
                <span className="text-white font-bold font-body">A2A</span>
              </div>
              <div>
                <div className="text-gray-800 font-bold font-heading">{tc('brandName')}</div>
                <div className="text-xs text-gray-400">{tc('brandTagline')}</div>
              </div>
            </div>
            <div className="text-sm text-gray-400">
              {tc('copyright')}
            </div>
            <div className="flex gap-6 text-sm">
              <Link href="/about" className="text-gray-500 hover:text-orange-500 transition-colors">
                {tc('about')}
              </Link>
              <Link href="/contact" className="text-gray-500 hover:text-orange-500 transition-colors">
                {tc('contact')}
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
