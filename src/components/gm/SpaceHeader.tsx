'use client'

import { useTranslations } from 'next-intl'

const THEME_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600' },
  slate: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600' },
}

interface Props {
  icon: string
  label: string
  accent: string
  online?: boolean
}

export default function SpaceHeader({ icon, label, accent, online = true }: Props) {
  const t = useTranslations('agentSpace')
  const theme = THEME_COLORS[accent] || THEME_COLORS.orange

  return (
    <div className={`border-b ${theme.border} ${theme.bg} backdrop-blur-sm`}>
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl ${theme.bg} border ${theme.border} flex items-center justify-center text-lg`}>
            {icon}
          </div>
          <div>
            <p className={`text-sm font-bold ${theme.text}`}>{t('spaceHeader.title', { scene: label })}</p>
            <p className="text-xs text-gray-400">{t('spaceHeader.gmName')}</p>
          </div>
        </div>
        {online && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-gray-400">{t('spaceHeader.online')}</span>
          </div>
        )}
      </div>
    </div>
  )
}
