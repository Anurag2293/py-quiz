import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { CheckCircle2Icon, CircleDashedIcon, ClockIcon, LightbulbIcon, XCircleIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { TRACKS } from '../../../convex/lib/tracks'
import { OptionList, QuestionBody, QuestionHeader } from '@/components/QuestionCard'
import type { QuestionView } from '@/components/QuestionCard'
import { RichText } from '@/components/RichText'
import { ScoreRing } from '@/components/ScoreRing'
import { FullPageSpinner } from '@/components/Spinner'
import { TrackChip } from '@/components/TrackChip'
import { RetryButton } from '@/components/RetryButton'
import { formatDate, formatDuration, pct, useToday } from '@/lib/format'
import { TRACK_COLORS } from '@/lib/tracks-ui'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_authed/results/$quizId')({ component: ResultsPage })

type Filter = 'all' | 'wrong' | 'right' | 'skipped'

function ResultsPage() {
  const { quizId } = Route.useParams()
  const data = useQuery(api.quiz.review, { quizId: quizId as Id<'quizzes'> })
  const me = useQuery(api.users.me)
  const today = useToday(me?.timezone)
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')
  const [track, setTrack] = useState<string | null>(null)

  useEffect(() => {
    if (data === null) navigate({ to: '/', replace: true })
    else if (data && data.status === 'in_progress') navigate({ to: '/quiz/$quizId', params: { quizId }, replace: true })
    else if (data && data.status === 'ready') navigate({ to: '/', replace: true })
  }, [data, navigate, quizId])

  const rows = useMemo(() => {
    if (!data || data.status !== 'submitted' || !data.responses) return []
    return data.questions.map((q, i) => ({
      q: q as (QuestionView & { qid: string }) | null,
      i,
      selected: data.responses![i] ?? [],
      correct: data.correct?.[i] ?? false,
    }))
  }, [data])

  if (!data || data.status !== 'submitted') return <FullPageSpinner />

  const score = data.score ?? 0
  const wrong = rows.filter((r) => !r.correct && r.selected.length > 0).length
  const skipped = rows.filter((r) => r.selected.length === 0).length
  const visible = rows.filter((r) => {
    if (track && r.q?.track !== track) return false
    if (filter === 'wrong') return !r.correct && r.selected.length > 0
    if (filter === 'right') return r.correct
    if (filter === 'skipped') return r.selected.length === 0
    return true
  })

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border bg-card p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {formatDate(data.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {data.attempt > 1 && ` · Retry ${data.attempt - 1}`}
          </p>
          {data.date === today && <RetryButton quizId={data._id} />}
        </div>
        {data.attempts.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-1.5 text-sm">
            {data.attempts.map((a) => (
              <Link
                key={a._id}
                to={a.status === 'submitted' ? '/results/$quizId' : '/quiz/$quizId'}
                params={{ quizId: a._id }}
                className={cn(
                  'rounded-md border px-2 py-0.5 text-muted-foreground transition-colors hover:bg-accent/40',
                  a._id === data._id && 'border-primary font-medium text-foreground',
                )}
              >
                {a.attempt === 1 ? 'First try' : `Retry ${a.attempt - 1}`}
                {' · '}
                {a.status === 'submitted' ? `${a.score ?? 0}/${a.total}` : 'running'}
              </Link>
            ))}
          </div>
        )}
        <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-center">
          <ScoreRing value={score} total={data.total} size={128} />
          <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Score" value={`${score}/${data.total}`} />
            <Metric
              label="Time taken"
              value={formatDuration(data.durationSec ?? 0)}
              hint={data.timeLimitSec ? `of ${Math.round(data.timeLimitSec / 60)} min` : undefined}
              icon={<ClockIcon className="size-3.5" />}
            />
            <Metric label="Wrong" value={String(wrong)} icon={<XCircleIcon className="size-3.5 text-destructive" />} />
            <Metric label="Skipped" value={String(skipped)} icon={<CircleDashedIcon className="size-3.5" />} />
          </div>
        </div>
        {data.autoSubmitted && (
          <p className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
            Time ran out, so the quiz was submitted automatically with the answers saved so far.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">By track</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {TRACKS.map((t) => {
            const s = data.trackStats?.find((x) => x.track === t.id)
            if (!s) return null
            const p = pct(s.correct, s.total)
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTrack(track === t.id ? null : t.id)}
                className={cn(
                  'rounded-xl border bg-card p-3 text-left transition-colors hover:bg-accent/40',
                  track === t.id && 'border-primary ring-1 ring-primary',
                )}
              >
                <div className="flex items-center justify-between gap-2 text-sm">
                  <TrackChip track={t.id} />
                  <span className="tabular-nums text-muted-foreground">
                    {s.correct}/{s.total} · {p}%
                  </span>
                </div>
                <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${p}%`, background: TRACK_COLORS[t.id]?.bar }} />
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Review</h2>
          <div className="flex rounded-lg border bg-card p-0.5 text-sm">
            {(
              [
                ['all', `All ${rows.length}`],
                ['wrong', `Wrong ${wrong}`],
                ['skipped', `Skipped ${skipped}`],
                ['right', `Right ${score}`],
              ] as [Filter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-muted-foreground transition-colors',
                  filter === key && 'bg-muted font-medium text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {track && (
          <p className="mb-3 text-sm text-muted-foreground">
            Showing {TRACKS.find((t) => t.id === track)?.label} only.{' '}
            <button type="button" className="underline underline-offset-2" onClick={() => setTrack(null)}>
              Show all tracks
            </button>
          </p>
        )}
        <div className="space-y-4">
          {visible.map(({ q, i, selected, correct }) =>
            q ? (
              <article key={i} className="space-y-4 rounded-2xl border bg-card p-4 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <QuestionHeader q={q} index={i} total={rows.length} />
                  <StatusPill correct={correct} skipped={selected.length === 0} />
                </div>
                <QuestionBody q={q} />
                <OptionList q={q} selected={selected} reveal />
                <div className="flex gap-2.5 rounded-xl bg-muted/60 p-3.5 text-sm leading-relaxed">
                  <LightbulbIcon className="mt-0.5 size-4 shrink-0 text-amber-500" />
                  <p>
                    <RichText text={q.explanation ?? ''} />
                  </p>
                </div>
              </article>
            ) : null,
          )}
          {visible.length === 0 && <p className="text-sm text-muted-foreground">Nothing here.</p>}
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value, hint, icon }: { label: string; value: string; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums">
        {value} {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
      </p>
    </div>
  )
}

function StatusPill({ correct, skipped }: { correct: boolean; skipped: boolean }) {
  if (correct)
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-success">
        <CheckCircle2Icon className="size-4" /> Correct
      </span>
    )
  if (skipped)
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
        <CircleDashedIcon className="size-4" /> Skipped
      </span>
    )
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-destructive">
      <XCircleIcon className="size-4" /> Wrong
    </span>
  )
}
