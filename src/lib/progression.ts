import { prisma } from "@/lib/db"
import { FSRS_TARGET_RETENTION } from "@/lib/constants"
import {
  allTags,
  FACETS,
  tagLabel,
  type Facet,
  type LanguageCode,
} from "@/lib/taxonomy"
import {
  bandProgressToNext,
  bucketCardsByTag,
  cardsToNextLevel,
  subLevelFromCards,
  subRetrievabilitySummary,
  tagKey,
  type CardTag,
  type TaggedCard,
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

export interface TagAggregate {
  facet: Facet
  tag: string
  label: string
  frequency: number
  tagLevel: number
  meanR: number
  lowR: number
  total: number // all cards carrying the tag (any role)
  focusTotal: number // cards where the tag is focus (drive graduation)
  cold: number
}

export interface TagTargetInfo {
  facet: Facet
  tag: string
  label: string
}

export interface PersonalisedTargets {
  targets: TagTargetInfo[]
  range: LevelRange
  weakTags: TagTargetInfo[]
}

interface StateRow {
  stability: number
  difficulty: number
  state: number
  scheduledDays: number
  learningSteps: number
  reps: number
  lapses: number
  lastReview: Date | null
  dueAt: Date | null
  question: { level: number; tags: Array<{ facet: string; tag: string; role: string }> }
}

function toTaggedCard(st: StateRow): TaggedCard {
  const tags: CardTag[] = st.question.tags.map((t) => ({
    facet: t.facet,
    tag: t.tag,
    role: t.role,
  }))
  return {
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
    tags,
  }
}

async function loadTaggedCards(userId: number, languageId: number): Promise<TaggedCard[]> {
  const states = await prisma.questionState.findMany({
    where: { userId, question: { languageId } },
    include: { question: { select: { level: true, tags: true } } },
  })
  return states.map(toTaggedCard)
}

export async function loadTagAggregates(
  userId: number,
  languageId: number,
  languageCode: LanguageCode,
): Promise<TagAggregate[]> {
  const cards = await loadTaggedCards(userId, languageId)
  const buckets = bucketCardsByTag(cards)
  const now = new Date()
  const out: TagAggregate[] = []
  for (const t of allTags(languageCode)) {
    const bucket = buckets.get(tagKey(t.facet, t.tag))
    const focusCards = bucket?.focusCards ?? []
    const allCards = bucket?.allCards ?? []
    const tagLevel = subLevelFromCards(focusCards)
    const summary = subRetrievabilitySummary(allCards, now, FSRS_TARGET_RETENTION)
    out.push({
      facet: t.facet,
      tag: t.tag,
      label: t.label,
      frequency: t.frequency,
      tagLevel,
      meanR: summary.meanR,
      lowR: summary.lowR,
      total: summary.total,
      focusTotal: focusCards.length,
      cold: summary.cold,
    })
  }
  return out
}

// Priority = weakness/level-gap, scaled by frequency so common skills surface
// first (the linear curriculum). frequency 1..5 → weight 0.33..1.67.
function tagPriority(a: TagAggregate): number {
  const levelScore = 5 - a.tagLevel
  const retentionPressure = a.lowR * 2
  const coldStart = a.total > 0 && a.cold / a.total > 0.5 ? 0.5 : 0
  const base = levelScore + retentionPressure + coldStart
  return base * (a.frequency / 3)
}

function levelRangeFor(meanEst: number): LevelRange {
  if (meanEst < 2) return LEVEL_RANGES[0]
  if (meanEst < 3) return LEVEL_RANGES[1]
  if (meanEst < 4) return LEVEL_RANGES[2]
  return LEVEL_RANGES[3]
}

// Overall CEFR estimate — frequency-weighted mean of per-tag levels. Rare tags
// contribute little, so an untouched niche tag doesn't tank the headline number.
export function overallLevel(aggregates: readonly TagAggregate[]): number {
  let num = 0
  let den = 0
  for (const a of aggregates) {
    num += a.tagLevel * a.frequency
    den += a.frequency
  }
  return den === 0 ? 0 : num / den
}

export function pickPersonalisedTargets(
  aggregates: readonly TagAggregate[],
): PersonalisedTargets | null {
  if (aggregates.length === 0) return null
  const ranked = aggregates
    .map((a) => ({ a, p: tagPriority(a) }))
    .sort((x, y) => y.p - x.p)

  // Top-priority tag per facet.
  const targets: TagTargetInfo[] = []
  for (const f of FACETS) {
    const top = ranked.find((r) => r.a.facet === f)
    if (top) targets.push({ facet: f, tag: top.a.tag, label: top.a.label })
  }

  const range = levelRangeFor(overallLevel(aggregates))
  const weakTags: TagTargetInfo[] = ranked
    .slice(0, 5)
    .map((r) => ({ facet: r.a.facet, tag: r.a.tag, label: r.a.label }))

  return { targets, range, weakTags }
}

export interface TagLevelSnapshotEntry {
  tagLevel: number
  cardsNeeded: number
  nextLevel: number | null
  bandProgress: number
}
export type TagLevelSnapshot = Record<string, TagLevelSnapshotEntry>

// Capture per-tag level + cards-to-next so the post-drill screen can show
// advancement without per-card storage. Keyed by `${facet}::${tag}`.
export async function snapshotTagLevels(
  userId: number,
  languageId: number,
  languageCode: LanguageCode,
): Promise<TagLevelSnapshot> {
  const cards = await loadTaggedCards(userId, languageId)
  const buckets = bucketCardsByTag(cards)
  const out: TagLevelSnapshot = {}
  for (const t of allTags(languageCode)) {
    const focusCards = buckets.get(tagKey(t.facet, t.tag))?.focusCards ?? []
    const tagLevel = subLevelFromCards(focusCards)
    const next = cardsToNextLevel(focusCards, tagLevel)
    const band = bandProgressToNext(focusCards, tagLevel)
    out[tagKey(t.facet, t.tag)] = {
      tagLevel,
      cardsNeeded: next?.needed ?? 0,
      nextLevel: next?.nextLevel ?? null,
      bandProgress: band.progress,
    }
  }
  return out
}

export interface TagReviewCount {
  total: number
  correct: number
}

// Lifetime per-tag review counts. A review fans out to every tag its question
// carries (join Review → Question → QuestionTag).
export async function loadTagReviewCounts(
  userId: number,
  languageId: number,
): Promise<Map<string, TagReviewCount>> {
  const reviews = await prisma.review.findMany({
    where: { userId, question: { languageId } },
    select: {
      correct: true,
      question: { select: { tags: { select: { facet: true, tag: true } } } },
    },
  })
  const out = new Map<string, TagReviewCount>()
  for (const r of reviews) {
    for (const t of r.question.tags) {
      const key = tagKey(t.facet, t.tag)
      const cur = out.get(key) ?? { total: 0, correct: 0 }
      cur.total++
      if (r.correct) cur.correct++
      out.set(key, cur)
    }
  }
  return out
}

export { tagLabel }
