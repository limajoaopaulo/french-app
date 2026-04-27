import { SAMPLING, FSRS_TARGET_RETENTION } from "@/lib/constants"
import { retrievability, State, type FSRSStateRow } from "@/lib/fsrs"

export interface SamplingCandidate {
  questionId: number
  pattern: string
  fsrsState: FSRSStateRow
  patternWeakness: number   // 0..1ish; higher = pattern less mastered (1 - meanR)
  patternStaleDays: number
}

export function questionWeight(
  c: SamplingCandidate,
  weakPatterns: Set<string>,
  now: Date,
  servedPatternCounts: Map<string, number>,
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

  // Pattern weakness — larger when the pattern's mean retrievability is low.
  w += c.patternWeakness * SAMPLING.patternWeaknessBonusMax

  // Weak-pattern targeting (top-K patterns inside scope).
  if (weakPatterns.has(c.pattern)) w *= SAMPLING.weakPatternMultiplier

  // Cold/stale pattern boost.
  if (c.patternStaleDays > SAMPLING.patternStalenessDays) {
    w *= SAMPLING.coldPatternBoost
  }

  // Round-robin damp: reduce weight for patterns already served this session.
  const already = servedPatternCounts.get(c.pattern) ?? 0
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
