import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { DEFAULT_TIMEZONE, TIMER_DEFAULT, TIMER_MAX, TIMER_MIN } from './lib/tracks'

export async function currentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null
  return await ctx.db
    .query('users')
    .withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.tokenIdentifier))
    .unique()
}

export async function requireUser(ctx: QueryCtx | MutationCtx) {
  const user = await currentUser(ctx)
  if (!user) throw new Error('Not signed in')
  return user
}

export const ensure = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not signed in')
    const existing = await currentUser(ctx)
    const name = identity.givenName ?? identity.name ?? undefined
    if (existing) {
      if (existing.name !== name || existing.email !== identity.email) {
        await ctx.db.patch(existing._id, { name, email: identity.email })
      }
      return existing._id
    }
    return await ctx.db.insert('users', {
      tokenIdentifier: identity.tokenIdentifier,
      clerkId: identity.subject,
      name,
      email: identity.email,
      timerMinutes: TIMER_DEFAULT,
      timezone: DEFAULT_TIMEZONE,
    })
  },
})

export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx)
    if (!user) return null
    return { name: user.name, timerMinutes: user.timerMinutes, timezone: user.timezone }
  },
})

export const updateSettings = mutation({
  args: { timerMinutes: v.number(), timezone: v.string() },
  handler: async (ctx, { timerMinutes, timezone }) => {
    const user = await requireUser(ctx)
    if (!Number.isInteger(timerMinutes) || timerMinutes < TIMER_MIN || timerMinutes > TIMER_MAX) {
      throw new Error(`Timer must be a whole number of minutes between ${TIMER_MIN} and ${TIMER_MAX}`)
    }
    try {
      new Intl.DateTimeFormat('en-CA', { timeZone: timezone })
    } catch {
      throw new Error('Unknown timezone')
    }
    await ctx.db.patch(user._id, { timerMinutes, timezone })
  },
})
