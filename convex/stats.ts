import { query } from './_generated/server'
import { TRACKS } from './lib/tracks'
import { currentUser } from './users'

export const history = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx)
    if (!user) return null
    const quizzes = await ctx.db
      .query('quizzes')
      .withIndex('by_user_status', (q) => q.eq('userId', user._id).eq('status', 'submitted'))
      .collect()
    const attempts = quizzes
      .map((q) => ({
        _id: q._id,
        date: q.date,
        score: q.score ?? 0,
        total: q.questionIds.length,
        durationSec: q.durationSec ?? 0,
        timeLimitSec: q.timeLimitSec ?? 0,
        autoSubmitted: q.autoSubmitted ?? false,
        trackStats: q.trackStats ?? [],
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const bank = await Promise.all(
      TRACKS.map(async (t) => {
        const total = (
          await ctx.db
            .query('questions')
            .withIndex('by_track', (q) => q.eq('track', t.id).eq('active', true))
            .collect()
        ).length
        const seenRows = await ctx.db
          .query('seen')
          .withIndex('by_user_track', (q) => q.eq('userId', user._id).eq('track', t.id))
          .collect()
        return { track: t.id, total, seen: seenRows.length }
      }),
    )

    return { attempts, bank }
  },
})
