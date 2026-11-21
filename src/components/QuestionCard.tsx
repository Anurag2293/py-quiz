import { CheckIcon, XIcon } from 'lucide-react'
import { CodeBlock, OutputText } from './CodeBlock'
import { RichText } from './RichText'
import { TrackChip } from './TrackChip'
import { DIFFICULTY_STYLE, TYPE_LABEL } from '@/lib/tracks-ui'
import { cn } from '@/lib/utils'

export type QuestionView = {
  track: string
  difficulty: string
  type: 'mcq' | 'output' | 'multi'
  prompt: string
  code?: string
  options: string[]
  topic?: string
  answer?: number[]
  explanation?: string
}

const LETTERS = 'ABCDEF'

export function QuestionHeader({ q, index, total }: { q: QuestionView; index: number; total: number }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
      <span className="font-medium text-muted-foreground tabular-nums">
        Q{index + 1}
        <span className="opacity-60">/{total}</span>
      </span>
      <TrackChip track={q.track} />
      <span className={cn('font-medium capitalize', DIFFICULTY_STYLE[q.difficulty])}>{q.difficulty}</span>
      <span className="text-muted-foreground">{TYPE_LABEL[q.type]}</span>
      {q.topic && <span className="text-muted-foreground">· {q.topic}</span>}
    </div>
  )
}

export function QuestionBody({ q }: { q: QuestionView }) {
  return (
    <div className="space-y-4">
      <p className="text-[15px] leading-relaxed font-medium sm:text-base">
        <RichText text={q.prompt} />
      </p>
      {q.code && <CodeBlock code={q.code} />}
    </div>
  )
}

export function OptionList({
  q,
  selected,
  onToggle,
  reveal = false,
}: {
  q: QuestionView
  selected: number[]
  onToggle?: (i: number) => void
  reveal?: boolean
}) {
  const multi = q.type === 'multi'
  return (
    <div className="space-y-2.5" role={multi ? 'group' : 'radiogroup'}>
      {q.options.map((opt, i) => {
        const isSelected = selected.includes(i)
        const isAnswer = reveal && (q.answer ?? []).includes(i)
        const wrongPick = reveal && isSelected && !isAnswer
        return (
          <button
            key={i}
            type="button"
            role={multi ? 'checkbox' : 'radio'}
            aria-checked={isSelected}
            disabled={!onToggle}
            onClick={() => onToggle?.(i)}
            className={cn(
              'group flex w-full items-start gap-3 rounded-xl border bg-card px-3.5 py-3 text-left text-sm transition-colors sm:text-[15px]',
              onToggle && 'cursor-pointer hover:border-primary/50 hover:bg-accent/40',
              !reveal && isSelected && 'border-primary bg-accent/60 ring-1 ring-primary',
              isAnswer && 'border-success/70 bg-success/10',
              wrongPick && 'border-destructive/60 bg-destructive/10',
              !onToggle && 'cursor-default',
            )}
          >
            <span
              className={cn(
                'mt-px flex size-6 shrink-0 items-center justify-center border text-xs font-semibold',
                multi ? 'rounded-md' : 'rounded-full',
                !reveal && isSelected && 'border-primary bg-primary text-primary-foreground',
                !reveal && !isSelected && 'text-muted-foreground',
                isAnswer && 'border-success bg-success text-white',
                wrongPick && 'border-destructive bg-destructive text-white',
                reveal && !isAnswer && !wrongPick && 'text-muted-foreground',
              )}
            >
              {isAnswer ? <CheckIcon className="size-3.5" /> : wrongPick ? <XIcon className="size-3.5" /> : LETTERS[i]}
            </span>
            <span className="min-w-0 flex-1 pt-0.5">
              {q.type === 'output' ? <OutputText text={opt} /> : <RichText text={opt} />}
            </span>
            {reveal && isSelected && (
              <span className="shrink-0 pt-0.5 text-xs text-muted-foreground">Your pick</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
