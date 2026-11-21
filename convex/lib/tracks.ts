export const TRACKS = [
  { id: 'python', label: 'Core Python', short: 'Python', perQuiz: 5 },
  { id: 'numpy', label: 'NumPy', short: 'NumPy', perQuiz: 4 },
  { id: 'pandas', label: 'pandas', short: 'pandas', perQuiz: 6 },
  { id: 'viz', label: 'matplotlib & seaborn', short: 'Viz', perQuiz: 4 },
  { id: 'cleaning', label: 'Data cleaning & EDA', short: 'Cleaning', perQuiz: 4 },
  { id: 'stats', label: 'Statistics', short: 'Stats', perQuiz: 4 },
  { id: 'sklearn', label: 'scikit-learn basics', short: 'sklearn', perQuiz: 3 },
] as const

export type TrackId = (typeof TRACKS)[number]['id']
export type Difficulty = 'easy' | 'medium' | 'hard'
export type QuestionType = 'mcq' | 'output' | 'multi'

export const QUESTIONS_PER_QUIZ = TRACKS.reduce((n, t) => n + t.perQuiz, 0)

export const TIMER_MIN = 45
export const TIMER_MAX = 60
export const TIMER_DEFAULT = 50
export const DEFAULT_TIMEZONE = 'Asia/Kolkata'

export function trackLabel(id: string): string {
  return TRACKS.find((t) => t.id === id)?.label ?? id
}

export function difficultyTargets(count: number): Record<Difficulty, number> {
  const hard = Math.max(1, Math.round(count * 0.23))
  const easy = Math.max(1, Math.round(count * 0.33))
  return { easy, medium: Math.max(0, count - hard - easy), hard }
}

export function dateInTimezone(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms))
}
