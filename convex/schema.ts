import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export const trackValidator = v.union(
  v.literal('python'),
  v.literal('numpy'),
  v.literal('pandas'),
  v.literal('viz'),
  v.literal('cleaning'),
  v.literal('stats'),
  v.literal('sklearn'),
)
export const difficultyValidator = v.union(v.literal('easy'), v.literal('medium'), v.literal('hard'))
export const questionTypeValidator = v.union(v.literal('mcq'), v.literal('output'), v.literal('multi'))

export const questionFields = {
  qid: v.string(),
  track: trackValidator,
  topic: v.string(),
  difficulty: difficultyValidator,
  type: questionTypeValidator,
  prompt: v.string(),
  code: v.optional(v.string()),
  options: v.array(v.string()),
  answer: v.array(v.number()),
  explanation: v.string(),
}

export const trackStatValidator = v.object({
  track: trackValidator,
  correct: v.number(),
  total: v.number(),
})

export default defineSchema({
  questions: defineTable({ ...questionFields, active: v.boolean() })
    .index('by_qid', ['qid'])
    .index('by_track', ['track', 'active']),

  users: defineTable({
    tokenIdentifier: v.string(),
    clerkId: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    timerMinutes: v.number(),
    timezone: v.string(),
  }).index('by_token', ['tokenIdentifier']),

  quizzes: defineTable({
    userId: v.id('users'),
    date: v.string(),
    questionIds: v.array(v.id('questions')),
    status: v.union(v.literal('ready'), v.literal('in_progress'), v.literal('submitted')),
    responses: v.array(v.array(v.number())),
    flagged: v.array(v.number()),
    timeLimitSec: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    deadline: v.optional(v.number()),
    submittedAt: v.optional(v.number()),
    durationSec: v.optional(v.number()),
    autoSubmitted: v.optional(v.boolean()),
    score: v.optional(v.number()),
    correct: v.optional(v.array(v.boolean())),
    trackStats: v.optional(v.array(trackStatValidator)),
  })
    .index('by_user_date', ['userId', 'date'])
    .index('by_user_status', ['userId', 'status']),

  seen: defineTable({
    userId: v.id('users'),
    questionId: v.id('questions'),
    track: trackValidator,
    lastSeenDate: v.string(),
    timesSeen: v.number(),
    timesCorrect: v.number(),
    lastCorrect: v.optional(v.boolean()),
  })
    .index('by_user_question', ['userId', 'questionId'])
    .index('by_user_track', ['userId', 'track']),
})
