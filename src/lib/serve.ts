import { prisma } from "@/lib/db"
import { SERVE_DISTRIBUTION } from "@/lib/constants"
import type { Domain } from "@/lib/taxonomy"
import {
  daysSince,
  questionWeight,
  weightedPick,
  type SamplingCandidate,
} from "@/lib/sampling"
import { patternMastery, type CardForLevel } from "@/lib/levels"
import { type FSRSStateRow } from "@/lib/fsrs"

export interface BossPick {
  question: ServedQuestion
  levelAtServe: number
  remainingQueue: number[]
}

export async function pickBossQuestion(args: {
  userId: number
  languageId: number
  bossDomain: string
  queue: number[]
  servedIds: number[]
}): Promise<BossPick | null> {
  let remaining = [...args.queue]
  while (remaining.length > 0) {
    const head = remaining[0]
    let row = await loadOneQuestion({
      userId: args.userId,
      languageId: args.languageId,
      domain: args.bossDomain,
      level: head,
      excludeIds: args.servedIds,
    })
    if (!row) {
      row = await loadOneQuestion({
        userId: args.userId,
        languageId: args.languageId,
        domain: args.bossDomain,
        level: head,
        excludeIds: [],
      })
    }
    remaining = remaining.slice(1)
    if (row) {
      return { question: toServed(row), levelAtServe: row.level, remainingQueue: remaining }
    }
  }
  return null
}

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
  domain: string
  sub: string
  level: number
  pattern: string
  counterpart: string | null
  cueType: string
  cue: string
  options: string[]
  correctIndex: number
  explanation: string
  register: string | null
  encounters: number
}

interface QuestionRow {
  id: number
  externalId: string
  domain: string
  sub: string
  level: number
  pattern: string
  counterpart: string | null
  cueType: string
  cue: string
  options: string
  correctIndex: number
  explanation: string
  register: string | null
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

async function loadOneQuestion(args: {
  userId: number
  languageId: number
  domain: string
  level: number
  excludeIds: number[]
}): Promise<QuestionRow | null> {
  const q = await prisma.question.findFirst({
    where: {
      languageId: args.languageId,
      domain: args.domain,
      level: args.level,
      id: args.excludeIds.length > 0 ? { notIn: args.excludeIds } : undefined,
    },
    include: { states: { where: { userId: args.userId }, take: 1 } },
  })
  if (!q) return null
  return shapeRow(q)
}

function shapeRow(
  q: {
    id: number
    externalId: string
    domain: string
    sub: string
    level: number
    pattern: string
    counterpart: string | null
    cueType: string
    cue: string
    options: string
    correctIndex: number
    explanation: string
    register: string | null
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
  },
): QuestionRow {
  const { states, ...rest } = q
  return { ...rest, state: states[0] ?? null }
}

export async function pickNextQuestion(args: {
  userId: number
  languageId: number
  sessionId: number
  domainFilter?: Domain
  servedIds: number[]
  targetSubs?: Array<{ domain: string; sub: string }>
  levelRange?: { min: number; max: number }
  prefetchedReviews?: Array<{ question: { pattern: string } }>
}): Promise<{ question: ServedQuestion; levelAtServe: number } | null> {
  const subScope = await resolveSubScope(args)
  if (subScope.length === 0) return null

  const subKeys = new Set(subScope.map((s) => `${s.domain}::${s.sub}`))
  const lvlMin = args.levelRange?.min ?? 1
  const lvlMax = args.levelRange?.max ?? 5

  let pool = await loadCandidates({
    userId: args.userId,
    languageId: args.languageId,
    subScope,
    lvlMin,
    lvlMax,
    excludeIds: args.servedIds,
  })
  if (pool.length === 0) {
    pool = await loadCandidates({
      userId: args.userId,
      languageId: args.languageId,
      subScope,
      lvlMin: 1,
      lvlMax: 5,
      excludeIds: args.servedIds,
    })
  }
  if (pool.length === 0) {
    pool = await loadCandidates({
      userId: args.userId,
      languageId: args.languageId,
      subScope,
      lvlMin: 1,
      lvlMax: 5,
      excludeIds: [],
    })
  }
  if (pool.length === 0) return null

  const now = new Date()

  const cardsForLevel: Array<CardForLevel & { pattern: string; subKey: string }> = pool.map(
    (q) => ({
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
      pattern: q.pattern,
      subKey: `${q.domain}::${q.sub}`,
    }),
  )
  const masteryByPattern = new Map<string, number>()
  for (const m of patternMastery(cardsForLevel, now)) {
    masteryByPattern.set(m.pattern, 1 - m.meanR)
  }

  const patterns = Array.from(new Set(pool.map((q) => q.pattern)))
  const patternStats = await prisma.patternStats.findMany({
    where: {
      userId: args.userId,
      pattern: { in: patterns },
      OR: subScope.map((s) => ({ domain: s.domain, sub: s.sub })),
    },
  })
  const lastSeenByKey = new Map<string, Date | null>()
  for (const ps of patternStats) {
    lastSeenByKey.set(`${ps.domain}::${ps.sub}::${ps.pattern}`, ps.lastSeenAt)
  }

  const weakRanked = Array.from(masteryByPattern.entries())
    .filter(([p]) =>
      cardsForLevel.some((c) => c.pattern === p && subKeys.has(c.subKey)),
    )
    .sort((a, b) => b[1] - a[1])
  const weakPatterns = new Set(weakRanked.slice(0, 5).map(([p]) => p))

  const reviews =
    args.prefetchedReviews ??
    (await prisma.review.findMany({
      where: { userId: args.userId, sessionId: args.sessionId },
      include: { question: { select: { pattern: true } } },
    }))
  const servedPatternCounts = new Map<string, number>()
  for (const r of reviews) {
    const key = r.question.pattern
    servedPatternCounts.set(key, (servedPatternCounts.get(key) ?? 0) + 1)
  }

  const candidates: SamplingCandidate[] = pool.map((q) => {
    const fsrsState = rowToFsrsState(q)
    const lastSeen = lastSeenByKey.get(`${q.domain}::${q.sub}::${q.pattern}`) ?? null
    return {
      questionId: q.id,
      pattern: q.pattern,
      fsrsState,
      patternWeakness: masteryByPattern.get(q.pattern) ?? 0.5,
      patternStaleDays: daysSince(lastSeen, now),
    }
  })

  const weights = candidates.map((c) =>
    questionWeight(c, weakPatterns, now, servedPatternCounts),
  )

  const indices = pool.map((_, i) => i)
  const pickedIndex = weightedPick(indices, weights)
  const picked = pool[pickedIndex]

  return {
    question: toServed(picked),
    levelAtServe: picked.level,
  }
}

async function resolveSubScope(args: {
  userId: number
  domainFilter?: Domain
  targetSubs?: Array<{ domain: string; sub: string }>
}): Promise<Array<{ domain: string; sub: string }>> {
  if (args.targetSubs && args.targetSubs.length > 0) {
    return args.targetSubs
  }
  const activeWhere = args.domainFilter
    ? { userId: args.userId, isActive: true, domain: args.domainFilter }
    : { userId: args.userId, isActive: true }
  const activeSubs = await prisma.subStats.findMany({ where: activeWhere })
  return activeSubs.map((s) => ({ domain: s.domain, sub: s.sub }))
}

async function loadCandidates(args: {
  userId: number
  languageId: number
  subScope: Array<{ domain: string; sub: string }>
  lvlMin: number
  lvlMax: number
  excludeIds: number[]
}): Promise<QuestionRow[]> {
  const rows = await prisma.question.findMany({
    where: {
      languageId: args.languageId,
      OR: args.subScope.map((s) => ({ domain: s.domain, sub: s.sub })),
      level: { gte: args.lvlMin, lte: args.lvlMax },
      id: args.excludeIds.length > 0 ? { notIn: args.excludeIds } : undefined,
    },
    include: { states: { where: { userId: args.userId }, take: 1 } },
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
