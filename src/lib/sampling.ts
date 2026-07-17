import { SAMPLING, FSRS_TARGET_RETENTION } from "@/lib/constants"
import { retrievability, State, type FSRSStateRow } from "@/lib/fsrs"

export interface SamplingCandidate {
  questionId: number
  tag: string // the question's targeted focus tag (`${facet}::${tag}`)
  fsrsState: FSRSStateRow
  tagWeakness: number // 0..1ish; higher = tag less mastered (1 - meanR)
  tagStaleDays: number
}

export function questionWeight(
  c: SamplingCandidate,
  weakTags: Set<string>,
  now: Date,
  servedTagCounts: Map<string, number>,
): number {
  let w = 1.0

  // Per-card retrievability boost — surfaces forgotten cards.
  const r = retrievability(c.fsrsState, now)
  if (c.fsrsState.state !== State.New) {
    const lowR = Math.max(0, FSRS_TARGET_RETENTION - r)
    w += lowR * SAMPLING.lowRBoostScale
  } else {
    // Cold card (never reviewed) — flat bonus so unseen cards get sampled.
    w += SAMPLING.coldCardBonus
  }

  // Due boost (multiplier) — anything past dueAt gets a 1.5× nudge.
  const due = c.fsrsState.dueAt
  if (due && due.getTime() <= now.getTime()) {
    w *= SAMPLING.dueBoost
  }

  // Tag weakness — larger when the tag's mean retrievability is low.
  w += c.tagWeakness * SAMPLING.patternWeaknessBonusMax

  // Weak-tag targeting (top-K tags inside scope).
  if (weakTags.has(c.tag)) w *= SAMPLING.weakPatternMultiplier

  // Cold/stale tag boost.
  if (c.tagStaleDays > SAMPLING.patternStalenessDays) {
    w *= SAMPLING.coldPatternBoost
  }

  // Round-robin damp: reduce weight for tags already served this session.
  const already = servedTagCounts.get(c.tag) ?? 0
  if (already > 0) {
    w *= Math.pow(SAMPLING.samePatternDampBase, already)
  }

  return Math.max(SAMPLING.weightFloor, w)
}

export function weightedPick<T>(
  items: T[],
  weights: number[],
  rng: () => number = Math.random,
): T {
  if (items.length === 0) throw new Error("weightedPick: empty items")
  if (items.length !== weights.length) {
    throw new Error("weightedPick: items/weights length mismatch")
  }
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) return items[Math.floor(rng() * items.length)]
  let r = rng() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

export function daysSince(date: Date | null, now: Date): number {
  if (!date) return Number.POSITIVE_INFINITY
  return (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
}
