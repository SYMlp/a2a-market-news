/**
 * Relative time strings using next-intl `time` namespace.
 * Pass `t` from `useTranslations('time')` or `getTranslations('time')`.
 */
export function formatTimeAgo(
  dateStr: string,
  t: (key: string, values?: { count: number }) => string,
): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return t('justNow')
  if (minutes < 60) return t('minutesAgo', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('hoursAgo', { count: hours })
  const days = Math.floor(hours / 24)
  if (days < 30) return t('daysAgo', { count: days })
  return t('monthsAgo', { count: Math.floor(days / 30) })
}
