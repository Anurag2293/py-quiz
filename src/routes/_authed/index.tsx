import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ArrowRightIcon, CalendarCheckIcon, ClockIcon, FlameIcon, ListChecksIcon, PlayIcon, TargetIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import { QUESTIONS_PER_QUIZ, TRACKS } from '../../../convex/lib/tracks'
import { FullPageSpinner } from '@/components/Spinner'
import { ScoreRing } from '@/components/ScoreRing'
import { TrackChip } from '@/components/TrackChip'
import { ButtonLink } from '@/components/ButtonLink'
import { RetryButton } from '@/components/RetryButton'
import { Button } from '@/components/ui/button'
import { formatClock, formatDate, formatDuration, pct, streaks, useNow, useToday } from '@/lib/format'

export const Route = createFileRoute('/_authed/')({ component: Dashboard })

function Dashboard() {
  const me = useQuery(api.users.me)
  const today = useToday(me?.timezone)
  const quiz = useQuery(api.quiz.byDate, today ? { date: today } : 'skip')
  const running = useQuery(api.quiz.running)
  const history = useQuery(api.stats.history)
  const ensureToday = useMutation(api.quiz.ensureToday)
  const requested = useRef<string | null>(null)

  useEffect(() => {
    if (quiz === null && today && requested.current !== today) {
      requested.current = today
      ensureToday().catch((e: Error) => toast.error(e.message))
    }
  }, [quiz, today, ensureToday])

  if (!me || !today || !quiz) return <FullPageSpinner label={quiz === null ? "Picking today's questions…" : undefined} />

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          {formatDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          {greeting()}
          {me.name ? `, ${me.name}` : ''}
        </h1>
      </div>

      {running
        ?.filter((r) => r.date !== today)
        .map((r) => <EarlierRunningCard key={r._id} quiz={r} />)}
      <TodayCard quiz={quiz} timerMinutes={me.timerMinutes} />
      {history && <QuickStats history={history} today={today} />}
    </div>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

type QuizSummary = NonNullable<ReturnType<typeof useQuery<typeof api.quiz.byDate>>>

function TodayCard({ quiz, timerMinutes }: { quiz: QuizSummary; timerMinutes: number }) {
  const navigate = useNavigate()
  const start = useMutation(api.quiz.start)
  const [starting, setStarting] = useState(false)
  const now = useNow(1000)

  const onStart = async () => {
    setStarting(true)
    try {
      await start({ quizId: quiz._id })
      await navigate({ to: '/quiz/$quizId', params: { quizId: quiz._id } })
    } catch (e) {
      toast.error((e as Error).message)
      setStarting(false)
    }
  }

  const retry = quiz.latestRetry
  if (quiz.status === 'submitted' && retry?.status === 'in_progress') {
    return <RunningCard quiz={retry} title={`Retry ${retry.attempt - 1} is running`} now={now} />
  }

  if (quiz.status === 'submitted') {
    const score = quiz.score ?? 0
    return (
      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:p-7">
          <ScoreRing value={score} total={quiz.total} />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium text-success">Today's quiz is done</p>
            <h2 className="text-xl font-semibold">
              {score} / {quiz.total} correct · {pct(score, quiz.total)}%
            </h2>
            <p className="text-sm text-muted-foreground">
              Finished in {formatDuration(quiz.durationSec ?? 0)}
              {quiz.autoSubmitted ? ' (auto-submitted when time ran out)' : ''}. A new quiz unlocks at midnight.
            </p>
            {retry?.status === 'submitted' && (
              <p className="text-sm text-muted-foreground">
                {quiz.retries === 1 ? 'Retried once' : `Retried ${quiz.retries} times`}. Latest retry:{' '}
                <ButtonLink
                  variant="link"
                  className="h-auto p-0"
                  to="/results/$quizId"
                  params={{ quizId: retry._id }}
                >
                  {retry.score ?? 0} / {retry.total} ({pct(retry.score ?? 0, retry.total)}%)
                </ButtonLink>
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              <ButtonLink to="/results/$quizId" params={{ quizId: quiz._id }}>
                Review answers <ArrowRightIcon data-icon="inline-end" />
              </ButtonLink>
              <RetryButton quizId={quiz._id} />
              <ButtonLink variant="outline" to="/history">
                See progress
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (quiz.status === 'in_progress') {
    return <RunningCard quiz={quiz} title="You have a quiz running" now={now} />
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border bg-card">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/10 to-transparent" />
      <div className="relative p-5 sm:p-7">
        <p className="text-sm font-medium text-primary">Today's quiz</p>
        <h2 className="mt-1 text-xl font-semibold sm:text-2xl">
          {quiz.total} questions · {timerMinutes} minutes
        </h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          A mix of multiple choice, predict-the-output and select-all questions across every track. The timer
          starts when you press start and the quiz submits itself when time runs out. Answers save as you go.
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {TRACKS.map((t) => (
            <TrackChip key={t.id} track={t.id} />
          ))}
        </div>
        <Button size="lg" className="mt-6 h-11 px-5 text-base" onClick={onStart} disabled={starting}>
          <PlayIcon data-icon="inline-start" /> {starting ? 'Starting…' : 'Start quiz'}
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          Change the timer (45 to 60 minutes) in{' '}
          <Link to="/settings" className="underline underline-offset-2">
            Settings
          </Link>
          .
        </p>
      </div>
    </section>
  )
}

function EarlierRunningCard({ quiz }: { quiz: NonNullable<QuizSummary['latestRetry']> }) {
  const now = useNow(1000)
  const label = quiz.attempt > 1 ? `Retry ${quiz.attempt - 1} of ${formatDate(quiz.date, { day: 'numeric', month: 'long' })}` : `The quiz for ${formatDate(quiz.date, { day: 'numeric', month: 'long' })}`
  return <RunningCard quiz={quiz} title={`${label} is still running`} now={now} />
}

function RunningCard({ quiz, title, now }: { quiz: QuizSummary | NonNullable<QuizSummary['latestRetry']>; title: string; now: number }) {
  const left = Math.max(0, ((quiz.deadline ?? 0) - now) / 1000)
  return (
    <section className="rounded-2xl border bg-card p-5 sm:p-7">
      <p className="text-sm font-medium text-primary">In progress</p>
      <h2 className="mt-1 text-xl font-semibold">{title}</h2>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <ClockIcon className="size-4" /> {formatClock(left)} left
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ListChecksIcon className="size-4" /> {quiz.answered} of {quiz.total} answered
        </span>
      </div>
      <ButtonLink size="lg" className="mt-5 h-10 px-4" to="/quiz/$quizId" params={{ quizId: quiz._id }}>
        Resume quiz <ArrowRightIcon data-icon="inline-end" />
      </ButtonLink>
    </section>
  )
}

type History = NonNullable<ReturnType<typeof useQuery<typeof api.stats.history>>>

function QuickStats({ history, today }: { history: History; today: string }) {
  const { attempts } = history
  const stats = useMemo(() => {
    const { current, longest } = streaks(
      attempts.map((a) => a.date),
      today,
    )
    const recent = attempts.slice(-7)
    const avg = recent.length
      ? Math.round(recent.reduce((s, a) => s + (a.score / a.total) * 100, 0) / recent.length)
      : null
    const byTrack = new Map<string, { c: number; t: number }>()
    for (const a of attempts.slice(-10)) {
      for (const s of a.trackStats) {
        const cur = byTrack.get(s.track) ?? { c: 0, t: 0 }
        cur.c += s.correct
        cur.t += s.total
        byTrack.set(s.track, cur)
      }
    }
    const weakest = [...byTrack.entries()]
      .filter(([, v]) => v.t >= 3)
      .map(([track, v]) => ({ track, acc: pct(v.c, v.t) }))
      .sort((a, b) => a.acc - b.acc)
      .slice(0, 2)
    return { current, longest, avg, weakest }
  }, [attempts, today])

  if (attempts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Your streak, scores and weakest tracks show up here after the first quiz.
      </p>
    )
  }

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat icon={<FlameIcon className="size-4 text-orange-500" />} label="Current streak" value={`${stats.current} day${stats.current === 1 ? '' : 's'}`} />
      <Stat icon={<CalendarCheckIcon className="size-4 text-primary" />} label="Best streak" value={`${stats.longest} day${stats.longest === 1 ? '' : 's'}`} />
      <Stat icon={<TargetIcon className="size-4 text-success" />} label="Avg (last 7)" value={stats.avg === null ? '–' : `${stats.avg}%`} />
      <div className="col-span-2 rounded-xl border bg-card p-4 sm:col-span-1">
        <p className="text-xs text-muted-foreground">Focus on</p>
        <div className="mt-2 flex flex-col items-start gap-1.5">
          {stats.weakest.length ? (
            stats.weakest.map((w) => (
              <span key={w.track} className="flex w-full items-center justify-between gap-2 text-sm">
                <TrackChip track={w.track} />
                <span className="tabular-nums text-muted-foreground">{w.acc}%</span>
              </span>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">Needs a few more quizzes</span>
          )}
        </div>
      </div>
      <p className="col-span-2 text-xs text-muted-foreground sm:col-span-4">
        {QUESTIONS_PER_QUIZ} questions a day.{' '}
        <Link to="/history" className="underline underline-offset-2">
          Full progress
        </Link>
      </p>
    </section>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon} {label}
      </p>
      <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}
