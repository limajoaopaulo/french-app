import { retrievability, type FSRSStateRow } from "@/lib/fsrs"

// Stability (in days) that a card must reach before it counts toward each CEFR level.
// Tuned defaults — open to recalibration after observed use.
export const STABILITY_THRESHOLDS_DAYS: Record<number, number> = {
  1: 0,    // A1 — any seen card counts
  2: 2,    // A2 — stable for ~2 days
  3: 7,    // B1 — stable for a week
  4: 21,   // B2 — stable for three weeks
  5: 60,   // C1 — stable for two months
}

export const CARDS_PER_LEVEL_THRESHOLD = 5
// Alias kept for callers that read this as "cards needed per level" — same
// number, clearer name at the call site.
export const MIN_CARDS_PER_LEVEL = CARDS_PER_LEVEL_THRESHOLD

export interface CardForLevel {
  level: number
  stability: number
  state: number
  lastReview: Date | null
  dueAt: Date | null
  difficulty: number
  scheduledDays: number
  learningSteps: number
  reps: number
  lapses: number
}

// subLevel = max L ∈ {1..5} such that there are ≥CARDS_PER_LEVEL_THRESHOLD
// cards with question.level ≥ L and stability ≥ T_L. The "level ≥ L" requirement
// means stable A2 knowledge can't fake B1+ — to reach L you need enough level-L
// (or harder) cards held in memory long enough.
//
// Decimal interpolation: at level L, add a fraction of the next step based on
// how close the qualifying cards are to next-level stability.
export function subLevelFromCards(cards: readonly CardForLevel[]): number {
  if (cards.length === 0) return 0

  let highest = 0
  for (let L = 1; L <= 5; L++) {
    const threshold = STABILITY_THRESHOLDS_DAYS[L]
    const qualifying = cards.filter(
      (c) => c.level >= L && c.stability >= threshold,
    )
    if (qualifying.length >= CARDS_PER_LEVEL_THRESHOLD) {
      highest = L
    }
  }

  if (highest === 0 || highest === 5) return highest

  // Interpolate toward the next level using the qualifying cards' stability
  // distance to the next threshold.
  const nextThreshold = STABILITY_THRESHOLDS_DAYS[highest + 1]
  const currentThreshold = STABILITY_THRESHOLDS_DAYS[highest]
  const span = Math.max(1e-6, nextThreshold - currentThreshold)
  const candidates = cards
    .filter((c) => c.level >= highest && c.stability >= currentThreshold)
    .map((c) => Math.min(1, (c.stability - currentThreshold) / span))
  if (candidates.length === 0) return highest
  const mean = candidates.reduce((a, b) => a + b, 0) / candidates.length
  return highest + mean
}

// How many more cards need to graduate to the next CEFR level's stability
// threshold for subLevel to tick up. Mirrors the rule in subLevelFromCards:
// a card "qualifies for level L" when question.level ≥ L AND stability ≥ T_L.
// Returns null when already at max (C1).
export function cardsToNextLevel(
  cards: readonly { level: number; stability: number }[],
  currentSubLevel: number,
): { needed: number; nextLevel: number } | null {
  const nextLevel = Math.floor(currentSubLevel) + 1
  if (nextLevel > 5) return null
  const threshold = STABILITY_THRESHOLDS_DAYS[nextLevel] ?? 0
  const have = cards.filter(
    (c) => c.level >= nextLevel && c.stability >= threshold,
  ).length
  const needed = Math.max(0, MIN_CARDS_PER_LEVEL - have)
  return { needed, nextLevel }
}

// Mean retrievability across the cards in a sub. Cards with state===New (never
// reviewed) contribute R=0. lowR is the average shortfall against a target.
export function subRetrievabilitySummary(
  cards: readonly CardForLevel[],
  now: Date,
  target: number,
): { meanR: number; lowR: number; total: number; cold: number } {
  if (cards.length === 0) return { meanR: 0, lowR: 0, total: 0, cold: 0 }

  let sumR = 0
  let cold = 0
  for (const c of cards) {
    const r = retrievability(toFsrsRow(c), now)
    sumR += r
    if (r === 0) cold++
  }
  const meanR = sumR / cards.length
  const lowR = Math.max(0, target - meanR)
  return { meanR, lowR, total: cards.length, cold }
}

export interface PatternMastery {
  pattern: string
  meanR: number
  meanStability: number
  cardCount: number
}

export function patternMastery(
  cards: readonly (CardForLevel & { pattern: string })[],
  now: Date,
): PatternMastery[] {
  const byPattern = new Map<string, (CardForLevel & { pattern: string })[]>()
  for (const c of cards) {
    const arr = byPattern.get(c.pattern) ?? []
    arr.push(c)
    byPattern.set(c.pattern, arr)
  }
  const out: PatternMastery[] = []
  for (const [pattern, list] of byPattern) {
    let sumR = 0
    let sumS = 0
    for (const c of list) {
      sumR += retrievability(toFsrsRow(c), now)
      sumS += c.stability
    }
    out.push({
      pattern,
      meanR: sumR / list.length,
      meanStability: sumS / list.length,
      cardCount: list.length,
    })
  }
  return out
}

function toFsrsRow(c: CardForLevel): FSRSStateRow {
  return {
    stability: c.stability,
    difficulty: c.difficulty,
    state: c.state,
    scheduledDays: c.scheduledDays,
    learningSteps: c.learningSteps,
    reps: c.reps,
    lapses: c.lapses,
    lastReview: c.lastReview,
    dueAt: c.dueAt,
  }
}
