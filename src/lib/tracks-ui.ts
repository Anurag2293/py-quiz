export const TRACK_COLORS: Record<string, { dot: string; chip: string; bar: string }> = {
  python: { dot: 'bg-violet-500', chip: 'bg-violet-500/10 text-violet-700 dark:text-violet-300', bar: '#8b5cf6' },
  numpy: { dot: 'bg-sky-500', chip: 'bg-sky-500/10 text-sky-700 dark:text-sky-300', bar: '#0ea5e9' },
  pandas: { dot: 'bg-emerald-500', chip: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', bar: '#10b981' },
  viz: { dot: 'bg-amber-500', chip: 'bg-amber-500/10 text-amber-700 dark:text-amber-300', bar: '#f59e0b' },
  cleaning: { dot: 'bg-rose-500', chip: 'bg-rose-500/10 text-rose-700 dark:text-rose-300', bar: '#f43f5e' },
  stats: { dot: 'bg-teal-500', chip: 'bg-teal-500/10 text-teal-700 dark:text-teal-300', bar: '#14b8a6' },
  sklearn: { dot: 'bg-orange-500', chip: 'bg-orange-500/10 text-orange-700 dark:text-orange-300', bar: '#f97316' },
}

export const DIFFICULTY_STYLE: Record<string, string> = {
  easy: 'text-emerald-700 dark:text-emerald-400',
  medium: 'text-amber-700 dark:text-amber-400',
  hard: 'text-rose-700 dark:text-rose-400',
}

export const TYPE_LABEL: Record<string, string> = {
  mcq: 'Multiple choice',
  output: 'Predict the output',
  multi: 'Select all that apply',
}
