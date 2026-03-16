/**
 * ISO week key utilities.
 * Week keys follow ISO 8601: "YYYY-Www" (e.g. "2026-W12").
 */

export function getWeekKey(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

export function getWeekRange(weekKey: string): { start: Date; end: Date } {
  const [yearStr, weekStr] = weekKey.split('-W')
  const year = parseInt(yearStr)
  const week = parseInt(weekStr)

  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dayOfWeek = jan4.getUTCDay() || 7
  const start = new Date(jan4)
  start.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1 + (week - 1) * 7)

  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 7)

  return { start, end }
}

export function getPreviousWeekKey(date: Date = new Date()): string {
  const prev = new Date(date)
  prev.setDate(prev.getDate() - 7)
  return getWeekKey(prev)
}
