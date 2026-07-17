import { prisma } from "@/lib/db"
import { SERVE_DISTRIBUTION } from "@/lib/constants"
import {
  daysSince,
  questionWeight,
  weightedPick,
  type SamplingCandidate,
} from "@/lib/sampling"
import {
  bucketCardsByTag,
  tagKey,
  type CardForLevel,
  type CardTag,
} from "@/lib/levels"
import { retrievability, type FSRSStateRow } from "@/lib/fsrs"

export function pickServeLevel(estimatedLevel: number, rng: () => number = Math.random): number {
  const base = Math.round(estimatedLevel)
  const r = rng()
  let level: number
  if (r < SERVE_DISTRIBUTION.atCurrent) level = base
  else if (r < SERVE_DISTRIBUTION.atCurrent + SERVE_DISTRIBUTION.oneAbove) level = base + 1
  else level = base - 1
  return Math.min(5, Math.max(1, level))
}

export interface ServedQuestion {
  id: number
  externalId: string
  level: number
  format: string
  cue: string
  blankHint: string | null
  translation: string | null
  options: string[]
  correctIndex: number
  explanation: string
  register: string | null
  tags: CardTag[]
  encounters: number
}

interface QuestionRow {
  id: number
  externalId: string
  level: number
  format: string
  cue: string
  blankHint: string | null
  translation: string | null
  options: string
  correctIndex: number
  explanation: string
  register: string | null
  tags: CardTag[]
  state: {
    stability: number
    difficulty: number
    state: number
    scheduledDays: number
    learningSteps: number
    reps: number
    lapses: number
    lastReview: Date | null
    dueAt: Date | null
  } | null
}

function rowToFsrsState(row: QuestionRow): FSRSStateRow {
  if (!row.state) {
    return {
      stability: 0,
      difficulty: 0,
      state: 0,
      scheduledDays: 0,
      learningSteps: 0,
      reps: 0,
      lapses: 0,
      lastReview: null,
      dueAt: null,
    }
  }
  return { ...row.state }
}

type RawQuestion = {
  id: number
  externalId: string
  level: number
  format: string
  cue: string
  blankHint: string | null
  translation: string | null
  options: string
  correctIndex: number
  explanation: string
  register: string | null
  tags: Array<{ facet: string; tag: string; role: string }>
  states: Array<{
    stability: number
    difficulty: number
    state: number
    scheduledDays: number
    learningSteps: number
    reps: number
    lapses: number
    lastReview: Date | null
    dueAt: Date | null
  }>
}

function shapeRow(q: RawQuestion): QuestionRow {
  const { states, tags, ...rest } = q
  return {
    ...rest,
    tags: tags.map((t) => ({ facet: t.facet, tag: t.tag, role: t.role })),
    state: states[0] ?? null,
  }
}

export interface TagTarget {
  facet: string
  tag: string
}

export async function pickNextQuestion(args: {
  userId: number
  languageId: number
  sessionId: number
  servedIds: number[]
  targetTags?: TagTarget[]
  levelRange?: { min: number; max: number }
}): Promise<{ question: ServedQuestion; levelAtServe: number } | null> {
  const lvlMin = args.levelRange?.min ?? 1
  const lvlMax = args.levelRange?.max ?? 5

  let pool = await loadCandidates({
    userId: args.userId,
    languageId: args.languageId,
    targetTags: args.targetTags,
    lvlMin,
    lvlMax,
    excludeIds: args.servedIds,
  })
  if (pool.length === 0) {
    pool = await loadCandidates({
      userId: args.userId,
      languageId: args.languageId,
      targetTags: args.targetTags,
      lvlMin: 1,
      lvlMax: 5,
      excludeIds: args.servedIds,
    })
  }
  if (pool.length === 0) {
    pool = await loadCandidates({
      userId: args.userId,
      languageId: args.languageId,
      targetTags: undefined,
      lvlMin: 1,
      lvlMax: 5,
      excludeIds: args.servedIds,
    })
  }
  if (pool.length === 0) return null

  const now = new Date()

  // Weakness per (facet::tag) from the pool's cards, bucketed by every tag.
  const taggedCards = pool.map((q) => ({
    level: q.level,
    stability: q.state?.stability ?? 0,
    difficulty: q.state?.difficulty ?? 0,
    state: q.state?.state ?? 0,
    scheduledDays: q.state?.scheduledDays ?? 0,
    learningSteps: q.state?.learningSteps ?? 0,
    reps: q.state?.reps ?? 0,
    lapses: q.state?.lapses ?? 0,
    lastReview: q.state?.lastReview ?? null,
    dueAt: q.state?.dueAt ?? null,
    tags: q.tags,
  }))
  const buckets = bucketCardsByTag(taggedCards)
  const weaknessByTag = new Map<string, number>()
  for (const [key, bucket] of buckets) {
    const summary = meanRetrievability(bucket.allCards, now)
    weaknessByTag.set(key, 1 - summary)
  }

  // Representative tag per question = the focus tag with max weakness. When a
  // target facet is set, prefer that facet's focus tag.
  const targetFacets = new Set((args.targetTags ?? []).map((t) => t.facet))
  function representativeTag(q: QuestionRow): string {
    const focus = q.tags.filter((t) => t.role === "focus")
    const candidates = focus.length > 0 ? focus : q.tags
    let best = candidates[0]
    let bestW = -1
    for (const t of candidates) {
      const key = tagKey(t.facet, t.tag)
      let w = weaknessByTag.get(key) ?? 0.5
      if (targetFacets.size > 0 && targetFacets.has(t.facet)) w += 1 // prefer targeted facet
      if (w > bestW) {
        bestW = w
        best = t
      }
    }
    return best ? tagKey(best.facet, best.tag) : "unknown"
  }

  // Weak-tag targeting: top-5 weakest tags present in the pool's focus tags.
  const focusTagKeys = new Set<string>()
  for (const q of pool) {
    for (const t of q.tags) if (t.role === "focus") focusTagKeys.add(tagKey(t.facet, t.tag))
  }
  const weakTags = new Set(
    Array.from(weaknessByTag.entries())
      .filter(([k]) => focusTagKeys.has(k))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k]) => k),
  )

  // Staleness per tag from TagStats.lastSeenAt.
  const tagStats = await prisma.tagStats.findMany({ where: { userId: args.userId } })
  const lastSeenByTag = new Map<string, Date | null>()
  for (const ts of tagStats) lastSeenByTag.set(tagKey(ts.facet, ts.tag), ts.lastSeenAt)

  // Round-robin damp by representative tag served this session.
  const reviews = await prisma.review.findMany({
    where: { userId: args.userId, sessionId: args.sessionId },
    include: { question: { select: { tags: { where: { role: "focus" } } } } },
  })
  const servedTagCounts = new Map<string, number>()
  for (const r of reviews) {
    for (const t of r.question.tags) {
      const key = tagKey(t.facet, t.tag)
      servedTagCounts.set(key, (servedTagCounts.get(key) ?? 0) + 1)
    }
  }

  const candidates: SamplingCandidate[] = pool.map((q) => {
    const repTag = representativeTag(q)
    return {
      questionId: q.id,
      tag: repTag,
      fsrsState: rowToFsrsState(q),
      tagWeakness: weaknessByTag.get(repTag) ?? 0.5,
      tagStaleDays: daysSince(lastSeenByTag.get(repTag) ?? null, now),
    }
  })

  const weights = candidates.map((c) =>
    questionWeight(c, weakTags, now, servedTagCounts),
  )

  const indices = pool.map((_, i) => i)
  const pickedIndex = weightedPick(indices, weights)
  const picked = pool[pickedIndex]

  return {
    question: toServed(picked),
    levelAtServe: picked.level,
  }
}

function meanRetrievability(cards: readonly CardForLevel[], now: Date): number {
  if (cards.length === 0) return 0
  let sum = 0
  for (const c of cards) sum += retrievability(c, now)
  return sum / cards.length
}

// SQLite caps bound parameters (~999). Loading a large pool with `include`
// generates `WHERE questionId IN (…)` over every candidate id, which blows that
// cap. So: (1) fetch matching ids cheaply, (2) randomly down-sample to CANDIDATE_CAP,
// (3) load the sampled rows with their tags + state. A capped random pool is fine —
// weighted sampling picks a single question from it anyway.
const CANDIDATE_CAP = 300

async function loadCandidates(args: {
  userId: number
  languageId: number
  targetTags?: TagTarget[]
  lvlMin: number
  lvlMax: number
  excludeIds: number[]
}): Promise<QuestionRow[]> {
  const where = {
    languageId: args.languageId,
    level: { gte: args.lvlMin, lte: args.lvlMax },
    ...(args.targetTags && args.targetTags.length > 0
      ? {
          tags: {
            some: {
              role: "focus",
              OR: args.targetTags.map((t) => ({ facet: t.facet, tag: t.tag })),
            },
          },
        }
      : {}),
    id: args.excludeIds.length > 0 ? { notIn: args.excludeIds } : undefined,
  }

  const idRows = await prisma.question.findMany({ where, select: { id: true } })
  let ids = idRows.map((r) => r.id)
  if (ids.length > CANDIDATE_CAP) {
    // Fisher-Yates partial shuffle to sample CANDIDATE_CAP ids.
    for (let i = 0; i < CANDIDATE_CAP; i++) {
      const j = i + Math.floor(Math.random() * (ids.length - i))
      ;[ids[i], ids[j]] = [ids[j], ids[i]]
    }
    ids = ids.slice(0, CANDIDATE_CAP)
  }
  if (ids.length === 0) return []

  const rows = await prisma.question.findMany({
    where: { id: { in: ids } },
    include: {
      tags: true,
      states: { where: { userId: args.userId }, take: 1 },
    },
  })
  return rows.map(shapeRow)
}

function toServed(row: QuestionRow): ServedQuestion {
  const { state, options, ...rest } = row
  return {
    ...rest,
    options: JSON.parse(options) as string[],
    encounters: state?.reps ?? 0,
  }
}
