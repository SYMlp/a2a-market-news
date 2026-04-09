type DateStyle = 'short' | 'medium' | 'long' | 'time'

const LOCALE_MAP: Record<string, string> = {
  zh: 'zh-CN',
  en: 'en-US',
}

const STYLE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  short: { year: 'numeric', month: 'short', day: 'numeric' },
  medium: { year: 'numeric', month: 'long', day: 'numeric' },
  long: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' },
  time: { hour: '2-digit', minute: '2-digit' },
}

export function formatDate(
  date: string | Date,
  locale: string = 'zh',
  style: DateStyle = 'short',
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const resolvedLocale = LOCALE_MAP[locale] || locale
  return d.toLocaleDateString(resolvedLocale, STYLE_OPTIONS[style])
}

export function formatDateTime(
  date: string | Date,
  locale: string = 'zh',
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const resolvedLocale = LOCALE_MAP[locale] || locale
  return d.toLocaleString(resolvedLocale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTime(
  date: string | Date,
  locale: string = 'zh',
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const resolvedLocale = LOCALE_MAP[locale] || locale
  return d.toLocaleTimeString(resolvedLocale, {
    hour: '2-digit',
    minute: '2-digit',
  })
}
