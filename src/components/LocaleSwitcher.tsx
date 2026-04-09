'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useCallback, useTransition } from 'react'

export default function LocaleSwitcher() {
  const locale = useLocale()
  const t = useTranslations('locale')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const toggleLocale = useCallback(() => {
    const next = locale === 'zh' ? 'en' : 'zh'
    startTransition(async () => {
      await fetch('/api/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: next }),
      })
      router.refresh()
    })
  }, [locale, router])

  return (
    <button
      onClick={toggleLocale}
      disabled={isPending}
      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-[#E8E0D8] text-gray-500 hover:text-orange-500 hover:border-orange-200 transition-colors disabled:opacity-50"
      aria-label={t('switchTo')}
    >
      {isPending ? '...' : t('switchTo')}
    </button>
  )
}
