import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { ArrowRightIcon, CalendarCheckIcon, FlameIcon, TrophyIcon, TargetIcon } from 'lucide-react'
import { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts'
import { api } from '../../../convex/_generated/api'
import { TRACKS } from '../../../convex/lib/tracks'
import { FullPageSpinner } from '@/components/Spinner'
import { TrackChip } from '@/components/TrackChip'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import { formatDate, formatDuration, pct, shiftDate, streaks, useToday } from '@/lib/format'
import { TRACK_COLORS } from '@/lib/tracks-ui'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_authed/history')({ component: HistoryPage })

const chartConfig = {
  score: { label: 'Score %', color: 'var(--chart-1)' },
} satisfies ChartConfig

function HistoryPage() {
  const me = useQuery(api.users.me)
  const today = useToday(me?.timezone)
  const data = useQuery(api.stats.history)

  const derived = useMemo(() => {
    if (!data || !today) return null
    const { attempts } = data
    const { current, longest } = streaks(
      attempts.map((a) => a.date),
      today,
    )
    const scores = attempts.map((a) => pct(a.score, a.total))
    const avg = scores.length ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length) : 0
    const best = scores.length ? Math.max(...scores) : 0

    const accumulate = (list: typeof attempts) => {
      const m = new Map<string, { c: number; t: number }>()
      for (const a of list)
        for (const s of a.trackStats) {
          const cur = m.get(s.track) ?? { c: 0, t: 0 }
          cur.c += s.correct
          cur.t += s.total
          m.set(s.track, cur)
        }
      return m
    }
    const all = accumulate(attempts)
    const recent = accumulate(attempts.slice(-5))
    const tracks = TRACKS.map((t) => ({
      track: t.id,
      all: all.get(t.id) ?? { c: 0, t: 0 },
      recent: recent.get(t.id) ?? { c: 0, t: 0 },
    })).sort((a, b) => {
      if (!a.all.t) return 1
      if (!b.all.t) return -1
      return a.all.c / a.all.t - b.all.c / b.all.t
    })

    const chart = attempts.map((a) => ({
      date: a.date,
      label: formatDate(a.date),
      score: pct(a.score, a.total),
    }))

    const days: { date: string; score: number | null }[] = []
    const byDate = new Map(attempts.map((a) => [a.date, pct(a.score, a.total)]))
    const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7
    const start = shiftDate(today, -(7 * 11 + weekday))
    for (let d = start; d <= today; d = shiftDate(d, 1)) days.push({ date: d, score: byDate.get(d) ?? null })

    return { current, longest, avg, best, tracks, chart, days }
  }, [data, today])

  if (!data || !derived) return <FullPageSpinner />
  const { attempts, bank } = data

  if (attempts.length === 0) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="text-xl font-semibold">No quizzes yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Finish today's quiz and your scores, streaks and weakest tracks will appear here.
        </p>
        <Link to="/" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
          Go to today's quiz <ArrowRightIcon className="size-4" />
        </Link>
      </div>
    )
  }

  const weakest = derived.tracks.filter((t) => t.all.t > 0).slice(0, 2).map((t) => t.track)

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile icon={<FlameIcon className="size-4 text-orange-500" />} label="Current streak" value={`${derived.current}d`} />
        <Tile icon={<CalendarCheckIcon className="size-4 text-primary" />} label="Longest streak" value={`${derived.longest}d`} />
        <Tile icon={<TargetIcon className="size-4 text-success" />} label="Average score" value={`${derived.avg}%`} hint={`${attempts.length} quizzes`} />
        <Tile icon={<TrophyIcon className="size-4 text-amber-500" />} label="Best score" value={`${derived.best}%`} />
      </section>

      <section className="rounded-2xl border bg-card p-4 sm:p-6">
        <h2 className="text-base font-semibold">Scores over time</h2>
        <ChartContainer config={chartConfig} className="mt-4 aspect-auto h-56 w-full sm:h-64">
          <LineChart data={derived.chart} margin={{ left: 0, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} width={36} />
            <ReferenceLine y={derived.avg} stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeOpacity={0.5} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              dataKey="score"
              type="monotone"
              stroke="var(--color-score)"
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: 'var(--color-score)' }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ChartContainer>
        <p className="mt-2 text-xs text-muted-foreground">Dashed line: your average.</p>
      </section>

      <section className="rounded-2xl border bg-card p-4 sm:p-6">
        <h2 className="text-base font-semibold">Last 12 weeks</h2>
        <div className="mt-4 overflow-x-auto">
          <div className="grid w-max grid-flow-col grid-rows-7 gap-1">
            {derived.days.map((d) => (
              <div
                key={d.date}
                title={d.score === null ? formatDate(d.date) : `${formatDate(d.date)}: ${d.score}%`}
                className={cn('size-3.5 rounded-[3px] sm:size-4', d.score === null ? 'bg-muted' : '')}
                style={
                  d.score === null
                    ? undefined
                    : { background: `color-mix(in oklch, var(--primary) ${25 + Math.round(d.score * 0.75)}%, transparent)` }
                }
              />
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Each square is a day; darker means a higher score.</p>
      </section>

      <section className="rounded-2xl border bg-card p-4 sm:p-6">
        <h2 className="text-base font-semibold">Tracks, weakest first</h2>
        <div className="mt-4 space-y-3.5">
          {derived.tracks.map(({ track, all, recent }) => {
            const p = pct(all.c, all.t)
            const b = bank.find((x) => x.track === track)
            return (
              <div key={track}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2">
                    <TrackChip track={track} />
                    {weakest.includes(track) && (
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                        Needs work
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {all.t ? `${p}% all time (${all.c}/${all.t})` : 'Not attempted'}
                    {recent.t ? ` · ${pct(recent.c, recent.t)}% last 5` : ''}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${p}%`, background: TRACK_COLORS[track]?.bar }} />
                </div>
                {b && (
                  <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                    Seen {b.seen} of {b.total} questions
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">All quizzes</h2>
        <div className="overflow-hidden rounded-2xl border bg-card">
          {[...attempts].reverse().map((a) => (
            <Link
              key={a._id}
              to="/results/$quizId"
              params={{ quizId: a._id }}
              className="flex items-center gap-4 border-b px-4 py-3 text-sm last:border-0 hover:bg-muted/50"
            >
              <span className="w-28 shrink-0 font-medium">{formatDate(a.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              <span className="w-16 tabular-nums">{pct(a.score, a.total)}%</span>
              <span className="hidden flex-1 text-muted-foreground tabular-nums sm:block">
                {a.score}/{a.total} · {formatDuration(a.durationSec)}
                {a.autoSubmitted ? ' · timed out' : ''}
              </span>
              <ArrowRightIcon className="ml-auto size-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

function Tile({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon} {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
