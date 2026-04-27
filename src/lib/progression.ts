import { prisma } from "@/lib/db"
import { BOSSES, FSRS_TARGET_RETENTION } from "@/lib/constants"
import { getDomains, type Domain, type LanguageCode } from "@/lib/taxonomy"
import {
  subLevelFromCards,
  subRetrievabilitySummary,
  type CardForLevel,
} from "@/lib/levels"

export interface LevelRange {
  label: "A1-A2" | "A2-B1" | "B1-B2" | "B2-C1"
  min: number
  max: number
}

export const LEVEL_RANGES: readonly LevelRange[] = [
  { label: "A1-A2", min: 1, max: 2 },
  { label: "A2-B1", min: 2, max: 3 },
  { label: "B1-B2", min: 3, max: 4 },
  { label: "B2-C1", min: 4, max: 5 },
] as const

export interface SubAggregate {
  domain: string
  sub: string
  isActive: boolean
  subLevel: number
  meanR: number
  lowR: number
  total: number
  cold: number
}

export interface TargetSub {
  domain: Domain
  sub: string
  label: string
}

export interface PersonalisedTargets {
  subs: TargetSub[]
  range: LevelRange
  weakPatterns: string[]
}

export async function loadSubAggregates(
  userId: number,
  languageId: number,
): Promise<SubAggregate[]> {
  const [subStats, states] = await Promise.all([
    prisma.subStats.findMany({ where: { userId } }),
    prisma.questionState.findMany({
      where: {
        userId,
        question: { languageId },
      },
      include: {
        question: { select: { domain: true, sub: true, level: true, pattern: true } },
      },
    }),
  ])

  const cardsBySub = new Map<string, CardForLevel[]>()
  for (const st of states) {
    const key = `${st.question.domain}::${st.question.sub}`
    const arr = cardsBySub.get(key) ?? []
    arr.push({
      level: st.question.level,
      stability: st.stability,
      difficulty: st.difficulty,
      state: st.state,
      scheduledDays: st.scheduledDays,
      learningSteps: st.learningSteps,
      reps: st.reps,
      lapses: st.lapses,
      lastReview: st.lastReview,
      dueAt: st.dueAt,
    })
    cardsBySub.set(key, arr)
  }

  const now = new Date()
  const out: SubAggregate[] = []
  for (const sub of subStats) {
    const key = `${sub.domain}::${sub.sub}`
    const cards = cardsBySub.get(key) ?? []
    const subLevel = subLevelFromCards(cards)
    const summary = subRetrievabilitySummary(cards, now, FSRS_TARGET_RETENTION)
    out.push({
      domain: sub.domain,
      sub: sub.sub,
      isActive: sub.isActive,
      subLevel,
      meanR: summary.meanR,
      lowR: summary.lowR,
      total: summary.total,
      cold: summary.cold,
    })
  }
  return out
}

function subPriority(s: SubAggregate): number {
  const levelScore = 5 - s.subLevel
  const retentionPressure = s.lowR * 2
  const coldStart = s.total > 0 && s.cold / s.total > 0.5 ? 0.5 : 0
  return levelScore + retentionPressure + coldStart
}

function levelRangeFor(meanEst: number): LevelRange {
  if (meanEst < 2) return LEVEL_RANGES[0]
  if (meanEst < 3) return LEVEL_RANGES[1]
  if (meanEst < 4) return LEVEL_RANGES[2]
  return LEVEL_RANGES[3]
}

export async function pickPersonalisedTargets(args: {
  userId: number
  languageId: number
  languageCode: LanguageCode
  subAggregates: SubAggregate[]
  domainFilter?: Domain
}): Promise<PersonalisedTargets | null> {
  let pool = args.subAggregates.filter((s) => s.isActive)
  if (args.domainFilter) pool = pool.filter((s) => s.domain === args.domainFilter)
  if (pool.length === 0) return null

  const ranked = pool
    .map((s) => ({ sub: s, priority: subPriority(s) }))
    .sort((a, b) => b.priority - a.priority)

  const picks = [ranked[0]]
  if (
    ranked.length > 1 &&
    ranked[0].priority > 0 &&
    ranked[1].priority / ranked[0].priority >= 0.7
  ) {
    picks.push(ranked[1])
  }

  const domains = getDomains(args.languageCode)
  const targetSubs: TargetSub[] = picks.map((p) => {
    const key = p.sub.domain as Domain
    const meta = domains[key]?.subs.find((x) => x.key === p.sub.sub)
    return {
      domain: key,
      sub: p.sub.sub,
      label: meta?.label ?? p.sub.sub,
    }
  })

  const meanEst =
    picks.reduce((acc, p) => acc + Math.max(1, p.sub.subLevel), 0) / picks.length
  const range = levelRangeFor(meanEst)

  const subDomainKeys = new Set(picks.map((p) => `${p.sub.domain}::${p.sub.sub}`))
  const states = await prisma.questionState.findMany({
    where: { userId: args.userId, question: { languageId: args.languageId } },
    include: {
      question: { select: { domain: true, sub: true, pattern: true } },
    },
  })
  type StateCard = {
    stability: number
    difficulty: number
    state: number
    scheduledDays: number
    learningSteps: number
    reps: number
    lapses: number
    lastReview: Date | null
    dueAt: Date | null
  }
  const cardsByPattern = new Map<string, StateCard[]>()
  for (const st of states) {
    const key = `${st.question.domain}::${st.question.sub}`
    if (!subDomainKeys.has(key)) continue
    const list = cardsByPattern.get(st.question.pattern) ?? []
    list.push({
      stability: st.stability,
      difficulty: st.difficulty,
      state: st.state,
      scheduledDays: st.scheduledDays,
      learningSteps: st.learningSteps,
      reps: st.reps,
      lapses: st.lapses,
      lastReview: st.lastReview,
      dueAt: st.dueAt,
    })
    cardsByPattern.set(st.question.pattern, list)
  }

  const { retrievability } = await import("@/lib/fsrs")
  const now = new Date()
  const patternWeakness: Array<{ pattern: string; weakness: number }> = []
  for (const [pattern, list] of cardsByPattern) {
    let sumR = 0
    for (const c of list) sumR += retrievability(c, now)
    const meanR = list.length === 0 ? 0 : sumR / list.length
    patternWeakness.push({ pattern, weakness: 1 - meanR })
  }
  patternWeakness.sort((a, b) => b.weakness - a.weakness)
  const weakPatterns = patternWeakness.slice(0, 5).map((p) => p.pattern)

  return { subs: targetSubs, range, weakPatterns }
}

export function computeUnlockedBossLevels(
  subAggregates: SubAggregate[],
  domain: Domain,
): number[] {
  const activeInDomain = subAggregates.filter(
    (s) => s.isActive && s.domain === domain,
  )
  if (activeInDomain.length === 0) return []
  const unlocked: number[] = []
  for (const level of BOSSES.levels) {
    if (activeInDomain.every((s) => s.subLevel >= level)) {
      unlocked.push(level)
    }
  }
  return unlocked
}

export interface SkillLossEntry {
  domain: string
  sub: string
  before: number
  after: number
}

export async function applyBossDefeatSkillLoss(args: {
  userId: number
  languageId: number
  domain: string
  bossLevel: number
}): Promise<SkillLossEntry[]> {
  const states = await prisma.questionState.findMany({
    where: {
      userId: args.userId,
      question: { languageId: args.languageId, domain: args.domain },
    },
    include: {
      question: { select: { sub: true, level: true } },
    },
  })

  const before = new Map<string, number>()
  const after = new Map<string, number>()

  for (const st of states) {
    const key = st.question.sub
    if (!before.has(key)) before.set(key, st.stability)
  }

  const updates = states.filter((st) => st.question.level >= args.bossLevel)
  for (const st of updates) {
    const newStability = Math.max(0.1, st.stability * 0.7)
    await prisma.questionState.update({
      where: { id: st.id },
      data: { stability: newStability },
    })
    after.set(st.question.sub, newStability)
  }

  const entries: SkillLossEntry[] = []
  for (const [sub, b] of before) {
    if (after.has(sub)) {
      entries.push({ domain: args.domain, sub, before: b, after: after.get(sub) ?? b })
    }
  }
  return entries
}
