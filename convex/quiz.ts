import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { internalMutation, mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { TRACKS, dateInTimezone, difficultyTargets } from './lib/tracks'
import type { Difficulty, TrackId } from './lib/tracks'
import { currentUser, requireUser } from './users'

const SUBMIT_GRACE_MS = 30_000

function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

async function pickQuestions(ctx: MutationCtx, userId: Id<'users'>) {
  const picked: Id<'questions'>[] = []
  const spareUnseen: Id<'questions'>[] = []
  const spareSeen: Id<'questions'>[] = []
  let shortfall = 0

  for (const track of TRACKS) {
    const pool = await ctx.db
      .query('questions')
      .withIndex('by_track', (q) => q.eq('track', track.id).eq('active', true))
      .collect()
    const seenRows = await ctx.db
      .query('seen')
      .withIndex('by_user_track', (q) => q.eq('userId', userId).eq('track', track.id))
      .collect()
    const seenById = new Map(seenRows.map((r) => [r.questionId, r]))

    const unseen = shuffle(pool.filter((q) => !seenById.has(q._id)))
    const seen = shuffle(pool.filter((q) => seenById.has(q._id))).sort((a, b) => {
      const ra = seenById.get(a._id)!
      const rb = seenById.get(b._id)!
      const wrongA = ra.lastCorrect === false ? 0 : 1
      const wrongB = rb.lastCorrect === false ? 0 : 1
      if (wrongA !== wrongB) return wrongA - wrongB
      return ra.lastSeenDate.localeCompare(rb.lastSeenDate)
    })

    const chosen = new Set<Id<'questions'>>()
    const targets = difficultyTargets(track.perQuiz)
    for (const d of ['hard', 'medium', 'easy'] as Difficulty[]) {
      for (const q of unseen.filter((x) => x.difficulty === d).slice(0, targets[d])) chosen.add(q._id)
    }
    for (const q of unseen) {
      if (chosen.size >= track.perQuiz) break
      chosen.add(q._id)
    }
    for (const q of seen) {
      if (chosen.size >= track.perQuiz) break
      chosen.add(q._id)
    }
    shortfall += track.perQuiz - chosen.size
    picked.push(...chosen)
    spareUnseen.push(...unseen.filter((q) => !chosen.has(q._id)).map((q) => q._id))
    spareSeen.push(...seen.filter((q) => !chosen.has(q._id)).map((q) => q._id))
  }

  if (shortfall > 0) {
    picked.push(...[...shuffle(spareUnseen), ...spareSeen].slice(0, shortfall))
  }
  return shuffle(picked)
}

function isCorrect(question: Doc<'questions'>, selected: number[]) {
  const picked = new Set(selected)
  const want = new Set(question.answer)
  return picked.size === want.size && [...picked].every((i) => want.has(i))
}

async function finalize(ctx: MutationCtx, quiz: Doc<'quizzes'>, responses: number[][], auto: boolean) {
  const now = Date.now()
  const questions = await Promise.all(quiz.questionIds.map((id) => ctx.db.get(id)))
  const correct = questions.map((q, i) => (q ? isCorrect(q, responses[i] ?? []) : false))

  const byTrack = new Map<TrackId, { correct: number; total: number }>()
  questions.forEach((q, i) => {
    if (!q) return
    const s = byTrack.get(q.track) ?? { correct: 0, total: 0 }
    s.total += 1
    if (correct[i]) s.correct += 1
    byTrack.set(q.track, s)
  })
  const trackStats = TRACKS.filter((t) => byTrack.has(t.id)).map((t) => ({ track: t.id, ...byTrack.get(t.id)! }))

  const end = Math.min(now, quiz.deadline ?? now)
  await ctx.db.patch(quiz._id, {
    status: 'submitted',
    responses,
    submittedAt: now,
    durationSec: Math.max(0, Math.round((end - (quiz.startedAt ?? end)) / 1000)),
    autoSubmitted: auto,
    score: correct.filter(Boolean).length,
    correct,
    trackStats,
  })

  if (isRetry(quiz)) return
  for (const [i, q] of questions.entries()) {
    if (!q) continue
    const row = await ctx.db
      .query('seen')
      .withIndex('by_user_question', (x) => x.eq('userId', quiz.userId).eq('questionId', q._id))
      .unique()
    if (row) {
      await ctx.db.patch(row._id, {
        lastSeenDate: quiz.date,
        timesSeen: row.timesSeen + 1,
        timesCorrect: row.timesCorrect + (correct[i] ? 1 : 0),
        lastCorrect: correct[i],
      })
    } else {
      await ctx.db.insert('seen', {
        userId: quiz.userId,
        questionId: q._id,
        track: q.track,
        lastSeenDate: quiz.date,
        timesSeen: 1,
        timesCorrect: correct[i] ? 1 : 0,
        lastCorrect: correct[i],
      })
    }
  }
}

async function ownQuiz(ctx: MutationCtx, quizId: Id<'quizzes'>) {
  const user = await requireUser(ctx)
  const quiz = await ctx.db.get(quizId)
  if (!quiz || quiz.userId !== user._id) throw new Error('Quiz not found')
  return { user, quiz }
}

export function isRetry(quiz: Doc<'quizzes'>) {
  return (quiz.attempt ?? 1) > 1
}

async function quizzesOn(ctx: QueryCtx, userId: Id<'users'>, date: string) {
  const all = await ctx.db
    .query('quizzes')
    .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', date))
    .collect()
  return all.sort((a, b) => (a.attempt ?? 1) - (b.attempt ?? 1))
}

async function begin(ctx: MutationCtx, quizId: Id<'quizzes'>, timerMinutes: number) {
  const startedAt = Date.now()
  const timeLimitSec = timerMinutes * 60
  const deadline = startedAt + timeLimitSec * 1000
  await ctx.db.patch(quizId, { status: 'in_progress', startedAt, timeLimitSec, deadline })
  await ctx.scheduler.runAt(deadline + 2_000, internal.quiz.autoSubmit, { quizId })
  return deadline
}

function summary(quiz: Doc<'quizzes'>) {
  return {
    _id: quiz._id,
    date: quiz.date,
    attempt: quiz.attempt ?? 1,
    status: quiz.status,
    total: quiz.questionIds.length,
    answered: quiz.responses.filter((r) => r.length > 0).length,
    timeLimitSec: quiz.timeLimitSec,
    deadline: quiz.deadline,
    score: quiz.score,
    durationSec: quiz.durationSec,
    autoSubmitted: quiz.autoSubmitted,
    trackStats: quiz.trackStats,
  }
}

export const ensureToday = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx)
    const date = dateInTimezone(Date.now(), user.timezone)
    const [existing] = await quizzesOn(ctx, user._id, date)
    if (existing) return { quizId: existing._id, date }

    const questionIds = await pickQuestions(ctx, user._id)
    if (questionIds.length === 0) throw new Error('The question bank is empty. Run the seed first.')
    const quizId = await ctx.db.insert('quizzes', {
      userId: user._id,
      date,
      questionIds,
      status: 'ready',
      responses: questionIds.map(() => []),
      flagged: [],
    })
    return { quizId, date }
  },
})

export const byDate = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const user = await currentUser(ctx)
    if (!user) return null
    const [quiz, ...retries] = await quizzesOn(ctx, user._id, date)
    if (!quiz) return null
    const latest = retries.at(-1)
    return { ...summary(quiz), retries: retries.length, latestRetry: latest ? summary(latest) : null }
  },
})

export const running = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx)
    if (!user) return null
    const quiz = await ctx.db
      .query('quizzes')
      .withIndex('by_user_status', (q) => q.eq('userId', user._id).eq('status', 'in_progress'))
      .first()
    return quiz ? summary(quiz) : null
  },
})

export const start = mutation({
  args: { quizId: v.id('quizzes') },
  handler: async (ctx, { quizId }) => {
    const { user, quiz } = await ownQuiz(ctx, quizId)
    if (quiz.status !== 'ready') return { deadline: quiz.deadline ?? 0 }
    const today = dateInTimezone(Date.now(), user.timezone)
    if (quiz.date !== today) throw new Error("This quiz was for another day. Open today's quiz instead.")
    return { deadline: await begin(ctx, quizId, user.timerMinutes) }
  },
})

export const retry = mutation({
  args: { quizId: v.id('quizzes') },
  handler: async (ctx, { quizId }) => {
    const { user, quiz } = await ownQuiz(ctx, quizId)
    const today = dateInTimezone(Date.now(), user.timezone)
    if (quiz.date !== today) throw new Error("Only today's quiz can be retried.")
    const all = await quizzesOn(ctx, user._id, today)
    const running = all.find((q) => q.status !== 'submitted')
    if (running) {
      if (running.status === 'ready') await begin(ctx, running._id, user.timerMinutes)
      return running._id
    }
    const questionIds = shuffle(all[0].questionIds)
    const retryId = await ctx.db.insert('quizzes', {
      userId: user._id,
      date: today,
      attempt: (all.at(-1)!.attempt ?? 1) + 1,
      questionIds,
      status: 'ready',
      responses: questionIds.map(() => []),
      flagged: [],
    })
    await begin(ctx, retryId, user.timerMinutes)
    return retryId
  },
})

export const take = query({
  args: { quizId: v.id('quizzes') },
  handler: async (ctx, { quizId }) => {
    const user = await currentUser(ctx)
    const quiz = await ctx.db.get(quizId)
    if (!user || !quiz || quiz.userId !== user._id) return null
    if (quiz.status !== 'in_progress') return { ...summary(quiz), questions: [], responses: null, flagged: null }
    const questions = await Promise.all(quiz.questionIds.map((id) => ctx.db.get(id)))
    return {
      ...summary(quiz),
      responses: quiz.responses,
      flagged: quiz.flagged,
      questions: questions.map((q) =>
        q
          ? {
              track: q.track,
              difficulty: q.difficulty,
              type: q.type,
              prompt: q.prompt,
              code: q.code,
              options: q.options,
            }
          : null,
      ),
    }
  },
})

export const answer = mutation({
  args: { quizId: v.id('quizzes'), index: v.number(), selected: v.array(v.number()) },
  handler: async (ctx, { quizId, index, selected }) => {
    const { quiz } = await ownQuiz(ctx, quizId)
    if (quiz.status !== 'in_progress') return false
    if (Date.now() > (quiz.deadline ?? 0) + SUBMIT_GRACE_MS) return false
    if (index < 0 || index >= quiz.questionIds.length) throw new Error('Bad question index')
    const responses = [...quiz.responses]
    responses[index] = [...new Set(selected)].sort((a, b) => a - b)
    await ctx.db.patch(quizId, { responses })
    return true
  },
})

export const toggleFlag = mutation({
  args: { quizId: v.id('quizzes'), index: v.number() },
  handler: async (ctx, { quizId, index }) => {
    const { quiz } = await ownQuiz(ctx, quizId)
    if (quiz.status !== 'in_progress') return
    const flagged = quiz.flagged.includes(index)
      ? quiz.flagged.filter((i) => i !== index)
      : [...quiz.flagged, index]
    await ctx.db.patch(quizId, { flagged })
  },
})

export const submit = mutation({
  args: { quizId: v.id('quizzes'), responses: v.optional(v.array(v.array(v.number()))) },
  handler: async (ctx, { quizId, responses }) => {
    const { quiz } = await ownQuiz(ctx, quizId)
    if (quiz.status === 'submitted') return
    if (quiz.status !== 'in_progress') throw new Error('Quiz has not started')
    const inTime = Date.now() <= (quiz.deadline ?? 0) + SUBMIT_GRACE_MS
    const final =
      inTime && responses && responses.length === quiz.questionIds.length ? responses : quiz.responses
    const late = Date.now() > (quiz.deadline ?? 0)
    await finalize(ctx, quiz, final, late)
  },
})

export const autoSubmit = internalMutation({
  args: { quizId: v.id('quizzes') },
  handler: async (ctx, { quizId }) => {
    const quiz = await ctx.db.get(quizId)
    if (!quiz || quiz.status !== 'in_progress') return
    await finalize(ctx, quiz, quiz.responses, true)
  },
})

export const review = query({
  args: { quizId: v.id('quizzes') },
  handler: async (ctx, { quizId }) => {
    const user = await currentUser(ctx)
    const quiz = await ctx.db.get(quizId)
    if (!user || !quiz || quiz.userId !== user._id) return null
    if (quiz.status !== 'submitted')
      return { ...summary(quiz), questions: [], responses: null, correct: null, attempts: [] }
    const questions = await Promise.all(quiz.questionIds.map((id) => ctx.db.get(id)))
    const attempts = (await quizzesOn(ctx, user._id, quiz.date)).map((q) => ({
      _id: q._id,
      attempt: q.attempt ?? 1,
      status: q.status,
      score: q.score,
      total: q.questionIds.length,
    }))
    return {
      ...summary(quiz),
      attempts,
      responses: quiz.responses,
      correct: quiz.correct ?? [],
      questions: questions.map((q) =>
        q
          ? {
              qid: q.qid,
              track: q.track,
              topic: q.topic,
              difficulty: q.difficulty,
              type: q.type,
              prompt: q.prompt,
              code: q.code,
              options: q.options,
              answer: q.answer,
              explanation: q.explanation,
            }
          : null,
      ),
    }
  },
})
