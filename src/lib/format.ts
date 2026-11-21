import { useEffect, useState } from 'react'
import { dateInTimezone } from '../../convex/lib/tracks'

export function useToday(timeZone: string | undefined) {
  const compute = () => (timeZone ? dateInTimezone(Date.now(), timeZone) : undefined)
  const [today, setToday] = useState(compute)
  useEffect(() => {
    setToday(compute())
    const id = setInterval(() => setToday(compute()), 30_000)
    return () => clearInterval(id)
  }, [timeZone])
  return today
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export function formatClock(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(h ? 2 : 1, '0')
  const ss = String(sec).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export function formatDuration(totalSec: number) {
  const m = Math.floor(totalSec / 60)
  const s = Math.round(totalSec % 60)
  if (m === 0) return `${s}s`
  return s ? `${m}m ${s}s` : `${m}m`
}

export function formatDate(date: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', { ...opts, timeZone: 'UTC' })
}

export function shiftDate(date: string, days: number) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

export function streaks(dates: string[], today: string) {
  const done = new Set(dates)
  let current = 0
  let cursor = done.has(today) ? today : shiftDate(today, -1)
  while (done.has(cursor)) {
    current++
    cursor = shiftDate(cursor, -1)
  }
  let longest = 0
  let run = 0
  let prev: string | null = null
  for (const d of [...done].sort()) {
    run = prev && shiftDate(prev, 1) === d ? run + 1 : 1
    longest = Math.max(longest, run)
    prev = d
  }
  return { current, longest }
}

export function pct(correct: number, total: number) {
  return total ? Math.round((correct / total) * 100) : 0
}
