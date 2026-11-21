import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ChevronLeftIcon, ChevronRightIcon, ClockIcon, FlagIcon, SendIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { OptionList, QuestionBody, QuestionHeader } from '@/components/QuestionCard'
import type { QuestionView } from '@/components/QuestionCard'
import { FullPageSpinner } from '@/components/Spinner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatClock, useNow } from '@/lib/format'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_authed/quiz/$quizId')({ component: QuizPage })

function QuizPage() {
  const { quizId } = Route.useParams()
  const id = quizId as Id<'quizzes'>
  const data = useQuery(api.quiz.take, { quizId: id })
  const navigate = useNavigate()

  useEffect(() => {
    if (data === null) navigate({ to: '/', replace: true })
    else if (data?.status === 'submitted') navigate({ to: '/results/$quizId', params: { quizId }, replace: true })
    else if (data?.status === 'ready') navigate({ to: '/', replace: true })
  }, [data, navigate, quizId])

  if (!data || data.status !== 'in_progress' || !data.responses) return <FullPageSpinner />
  return (
    <QuizRunner
      quizId={id}
      deadline={data.deadline ?? 0}
      questions={data.questions as (QuestionView | null)[]}
      initialResponses={data.responses}
      initialFlagged={data.flagged ?? []}
    />
  )
}

function QuizRunner({
  quizId,
  deadline,
  questions,
  initialResponses,
  initialFlagged,
}: {
  quizId: Id<'quizzes'>
  deadline: number
  questions: (QuestionView | null)[]
  initialResponses: number[][]
  initialFlagged: number[]
}) {
  const navigate = useNavigate()
  const saveAnswer = useMutation(api.quiz.answer)
  const toggleFlagMutation = useMutation(api.quiz.toggleFlag)
  const submitMutation = useMutation(api.quiz.submit)

  const [responses, setResponses] = useState(initialResponses)
  const [flagged, setFlagged] = useState(() => new Set(initialFlagged))
  const [index, setIndex] = useState(() => {
    const firstOpen = initialResponses.findIndex((r) => r.length === 0)
    return firstOpen === -1 ? 0 : firstOpen
  })
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const responsesRef = useRef(responses)
  responsesRef.current = responses
  const submittedRef = useRef(false)
  const warned = useRef(new Set<number>())

  const now = useNow(250)
  const leftSec = Math.max(0, (deadline - now) / 1000)
  const total = questions.length
  const q = questions[index]
  const answeredCount = responses.filter((r) => r.length > 0).length

  const doSubmit = useCallback(
    async (auto: boolean) => {
      if (submittedRef.current) return
      submittedRef.current = true
      setSubmitting(true)
      try {
        await submitMutation({ quizId, responses: responsesRef.current })
        if (auto) toast.info("Time's up. Your quiz was submitted.")
        await navigate({ to: '/results/$quizId', params: { quizId } })
      } catch (e) {
        submittedRef.current = false
        setSubmitting(false)
        toast.error(`Couldn't submit: ${(e as Error).message}`)
      }
    },
    [navigate, quizId, submitMutation],
  )

  useEffect(() => {
    if (leftSec <= 0) {
      void doSubmit(true)
      return
    }
    for (const mark of [300, 60]) {
      if (leftSec <= mark && !warned.current.has(mark)) {
        warned.current.add(mark)
        if (leftSec > mark - 5) toast.warning(`${mark / 60} minute${mark === 60 ? '' : 's'} left`)
      }
    }
  }, [leftSec, doSubmit])

  const choose = useCallback(
    (optionIndex: number) => {
      const question = questions[index]
      if (!question || submittedRef.current) return
      const cur = responsesRef.current[index]
      let next: number[]
      if (question.type === 'multi') {
        next = cur.includes(optionIndex)
          ? cur.filter((i) => i !== optionIndex)
          : [...cur, optionIndex].sort((a, b) => a - b)
      } else {
        next = cur[0] === optionIndex ? [] : [optionIndex]
      }
      const copy = [...responsesRef.current]
      copy[index] = next
      responsesRef.current = copy
      setResponses(copy)
      saveAnswer({ quizId, index, selected: next }).catch(() =>
        toast.error('Could not save that answer. It will be sent again when you submit.'),
      )
    },
    [index, questions, quizId, saveAnswer],
  )

  const toggleFlag = useCallback(() => {
    setFlagged((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
    toggleFlagMutation({ quizId, index }).catch(() => {})
  }, [index, quizId, toggleFlagMutation])

  const go = useCallback((i: number) => setIndex(Math.min(total - 1, Math.max(0, i))), [total])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || confirmOpen) return
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, [contenteditable]')) return
      const key = e.key.toLowerCase()
      const letter = 'abcdef'.indexOf(key)
      const digit = '123456'.indexOf(key)
      const opt = letter !== -1 ? letter : digit
      if (opt !== -1 && q && opt < q.options.length) {
        e.preventDefault()
        choose(opt)
      } else if (key === 'arrowright' || key === 'n') {
        e.preventDefault()
        go(index + 1)
      } else if (key === 'arrowleft' || key === 'p') {
        e.preventDefault()
        go(index - 1)
      } else if (key === 'f') {
        e.preventDefault()
        toggleFlag()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [choose, confirmOpen, go, index, q, toggleFlag])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [index])

  const lowTime = leftSec <= 300
  const unanswered = total - answeredCount

  return (
    <div className="pb-20 lg:pb-0">
      <div className="sticky top-14 z-20 -mx-4 mb-5 border-b bg-background/90 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-sm font-medium tabular-nums',
              lowTime ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'bg-card',
              leftSec <= 60 && 'animate-pulse',
            )}
            aria-live="off"
          >
            <ClockIcon className="size-3.5" /> {formatClock(leftSec)}
          </div>
          <div className="hidden flex-1 items-center gap-2 sm:flex">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${(answeredCount / total) * 100}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {answeredCount}/{total} answered
            </span>
          </div>
          <span className="flex-1 text-xs text-muted-foreground tabular-nums sm:hidden">
            {answeredCount}/{total}
          </span>
          <Button onClick={() => setConfirmOpen(true)} disabled={submitting}>
            <SendIcon data-icon="inline-start" /> Submit
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0 space-y-5">
          {q ? (
            <>
              <QuestionHeader q={q} index={index} total={total} />
              <QuestionBody q={q} />
              <OptionList q={q} selected={responses[index]} onToggle={choose} />
              {q.type === 'multi' && (
                <p className="text-xs text-muted-foreground">More than one option can be correct. All correct options are needed for the mark.</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">This question is no longer available. Skip it.</p>
          )}

          <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:pt-2">
            <Button variant="outline" size="lg" onClick={() => go(index - 1)} disabled={index === 0}>
              <ChevronLeftIcon data-icon="inline-start" /> Prev
            </Button>
            <Button
              variant={flagged.has(index) ? 'secondary' : 'ghost'}
              size="lg"
              onClick={toggleFlag}
              className={cn(flagged.has(index) && 'text-amber-600 dark:text-amber-400')}
            >
              <FlagIcon data-icon="inline-start" className={cn(flagged.has(index) && 'fill-current')} />
              <span className="hidden sm:inline">{flagged.has(index) ? 'Flagged' : 'Flag'}</span>
            </Button>
            <div className="flex-1" />
            {index < total - 1 ? (
              <Button size="lg" onClick={() => go(index + 1)}>
                Next <ChevronRightIcon data-icon="inline-end" />
              </Button>
            ) : (
              <Button size="lg" onClick={() => setConfirmOpen(true)}>
                Finish <SendIcon data-icon="inline-end" />
              </Button>
            )}
          </div>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-32 lg:self-start">
          <div className="rounded-xl border bg-card p-3">
            <p className="mb-2.5 text-xs font-medium text-muted-foreground">Questions</p>
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-10 lg:grid-cols-5">
              {questions.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Question ${i + 1}`}
                  className={cn(
                    'relative flex h-9 items-center justify-center rounded-md border text-xs font-medium tabular-nums transition-colors',
                    responses[i]?.length ? 'border-primary/30 bg-primary/15 text-foreground' : 'text-muted-foreground hover:bg-muted',
                    i === index && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
                  )}
                >
                  {i + 1}
                  {flagged.has(i) && <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-amber-500" />}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="size-2.5 rounded-sm border border-primary/30 bg-primary/15" /> Answered
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-amber-500" /> Flagged
              </span>
            </div>
          </div>
          <p className="hidden text-[11px] leading-relaxed text-muted-foreground lg:block">
            Keys: <Kbd>A</Kbd>–<Kbd>E</Kbd> or <Kbd>1</Kbd>–<Kbd>5</Kbd> pick, <Kbd>←</Kbd> <Kbd>→</Kbd> move,{' '}
            <Kbd>F</Kbd> flag. Answers save automatically and the timer keeps running if you leave.
          </p>
        </aside>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit the quiz?</DialogTitle>
            <DialogDescription>
              {unanswered > 0
                ? `${unanswered} question${unanswered === 1 ? ' is' : 's are'} unanswered.`
                : 'Every question has an answer.'}
              {flagged.size > 0 ? ` ${flagged.size} flagged for review.` : ''} You have {formatClock(leftSec)} left.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Keep going</DialogClose>
            <Button onClick={() => void doSubmit(false)} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">{children}</kbd>
}
