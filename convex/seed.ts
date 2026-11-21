import { internalMutation } from './_generated/server'
import cleaning from '../questions/cleaning.json'
import numpy from '../questions/numpy.json'
import pandas from '../questions/pandas.json'
import python from '../questions/python.json'
import sklearn from '../questions/sklearn.json'
import stats from '../questions/stats.json'
import viz from '../questions/viz.json'
import type { Difficulty, QuestionType, TrackId } from './lib/tracks'

type RawQuestion = {
  id: string
  track: string
  topic: string
  difficulty: string
  type: string
  prompt: string
  code?: string
  options: string[]
  answer: number[]
  explanation: string
}

const BANK: RawQuestion[] = [python, numpy, pandas, viz, cleaning, stats, sklearn].flat()

export const questions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query('questions').collect()
    const byQid = new Map(existing.map((q) => [q.qid, q]))
    const incoming = new Set<string>()
    let inserted = 0
    let updated = 0
    let deactivated = 0

    for (const raw of BANK) {
      incoming.add(raw.id)
      const doc = {
        qid: raw.id,
        track: raw.track as TrackId,
        topic: raw.topic,
        difficulty: raw.difficulty as Difficulty,
        type: raw.type as QuestionType,
        prompt: raw.prompt,
        code: raw.code,
        options: raw.options,
        answer: raw.answer,
        explanation: raw.explanation,
        active: true,
      }
      const prev = byQid.get(raw.id)
      if (!prev) {
        await ctx.db.insert('questions', doc)
        inserted++
      } else {
        await ctx.db.replace(prev._id, doc)
        updated++
      }
    }
    for (const q of existing) {
      if (!incoming.has(q.qid) && q.active) {
        await ctx.db.patch(q._id, { active: false })
        deactivated++
      }
    }
    return { total: BANK.length, inserted, updated, deactivated }
  },
})
