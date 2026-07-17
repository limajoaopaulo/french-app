import { describe, expect, test } from "vitest"
import {
  questionWeight,
  weightedPick,
  daysSince,
  type SamplingCandidate,
} from "@/lib/sampling"
import { State, type FSRSStateRow } from "@/lib/fsrs"

const NOW = new Date("2026-01-01T00:00:00Z")
const DAY = 1000 * 60 * 60 * 24

function newState(overrides: Partial<FSRSStateRow> = {}): FSRSStateRow {
  return {
    stability: 0,
    difficulty: 0,
    state: State.New,
    scheduledDays: 0,
    learningSteps: 0,
    reps: 0,
    lapses: 0,
    lastReview: null,
    dueAt: null,
    ...overrides,
  }
}

// A well-remembered review card: reviewed just now, high stability, not due.
// retrievability ≈ 1 so the low-R boost is ~0, isolating the tag multipliers.
function freshReviewState(overrides: Partial<FSRSStateRow> = {}): FSRSStateRow {
  return {
    stability: 1000,
    difficulty: 5,
    state: State.Review,
    scheduledDays: 1000,
    learningSteps: 0,
    reps: 5,
    lapses: 0,
    lastReview: NOW,
    dueAt: new Date(NOW.getTime() + 30 * DAY),
    ...overrides,
  }
}

function candidate(overrides: Partial<SamplingCandidate> = {}): SamplingCandidate {
  return {
    questionId: 1,
    tag: "grammar::conjugation",
    fsrsState: freshReviewState(),
    tagWeakness: 0,
    tagStaleDays: 0,
    ...overrides,
  }
}

const NO_WEAK = new Set<string>()
const NO_SERVED = new Map<string, number>()

describe("questionWeight", () => {
  test("baseline: a fresh, well-remembered card with no signals ≈ 1.0", () => {
    const w = questionWeight(candidate(), NO_WEAK, NOW, NO_SERVED)
    expect(w).toBeCloseTo(1.0, 2)
  })

  test("cold (never-reviewed) card gets a flat bonus over the baseline", () => {
    const cold = candidate({ fsrsState: newState() })
    const w = questionWeight(cold, NO_WEAK, NOW, NO_SERVED)
    // 1.0 + coldCardBonus(0.4)
    expect(w).toBeCloseTo(1.4, 2)
    expect(w).toBeGreaterThan(
      questionWeight(candidate(), NO_WEAK, NOW, NO_SERVED),
    )
  })

  test("tag weakness adds up to the weakness bonus max", () => {
    const base = questionWeight(candidate(), NO_WEAK, NOW, NO_SERVED)
    const weak = questionWeight(
      candidate({ tagWeakness: 1 }),
      NO_WEAK,
      NOW,
      NO_SERVED,
    )
    // patternWeaknessBonusMax = 0.5
    expect(weak - base).toBeCloseTo(0.5, 2)
  })

  test("weak-tag membership multiplies the weight", () => {
    const c = candidate()
    const base = questionWeight(c, NO_WEAK, NOW, NO_SERVED)
    const boosted = questionWeight(c, new Set([c.tag]), NOW, NO_SERVED)
    // weakPatternMultiplier = 1.4
    expect(boosted).toBeCloseTo(base * 1.4, 2)
  })

  test("a due card gets the due multiplier", () => {
    // lastReview = NOW keeps retrievability high so only the due flag differs.
    const notDue = candidate({
      fsrsState: freshReviewState({ dueAt: new Date(NOW.getTime() + DAY) }),
    })
    const due = candidate({
      fsrsState: freshReviewState({ dueAt: new Date(NOW.getTime() - DAY) }),
    })
    const wNotDue = questionWeight(notDue, NO_WEAK, NOW, NO_SERVED)
    const wDue = questionWeight(due, NO_WEAK, NOW, NO_SERVED)
    // dueBoost = 1.5
    expect(wDue).toBeCloseTo(wNotDue * 1.5, 2)
  })

  test("a stale tag gets the cold-tag boost", () => {
    const fresh = questionWeight(
      candidate({ tagStaleDays: 1 }),
      NO_WEAK,
      NOW,
      NO_SERVED,
    )
    const stale = questionWeight(
      candidate({ tagStaleDays: 30 }),
      NO_WEAK,
      NOW,
      NO_SERVED,
    )
    // coldPatternBoost = 1.2, threshold = 14 days
    expect(stale).toBeCloseTo(fresh * 1.2, 2)
  })

  test("round-robin damp shrinks weight for already-served tags", () => {
    const c = candidate()
    const base = questionWeight(c, NO_WEAK, NOW, NO_SERVED)
    const servedOnce = questionWeight(
      c,
      NO_WEAK,
      NOW,
      new Map([[c.tag, 1]]),
    )
    const servedTwice = questionWeight(
      c,
      NO_WEAK,
      NOW,
      new Map([[c.tag, 2]]),
    )
    // samePatternDampBase = 0.6 → 0.6^n
    expect(servedOnce).toBeCloseTo(base * 0.6, 2)
    expect(servedTwice).toBeCloseTo(base * 0.6 * 0.6, 2)
    expect(servedTwice).toBeLessThan(servedOnce)
  })

  test("weight never drops below the floor", () => {
    const c = candidate()
    const w = questionWeight(c, NO_WEAK, NOW, new Map([[c.tag, 40]]))
    // 0.6^40 is effectively 0 but weightFloor = 0.05
    expect(w).toBeCloseTo(0.05, 5)
  })
})

describe("weightedPick", () => {
  test("throws on empty items", () => {
    expect(() => weightedPick([], [])).toThrow()
  })

  test("throws on length mismatch", () => {
    expect(() => weightedPick(["a"], [1, 2])).toThrow()
  })

  test("picks the only item with positive weight", () => {
    const picked = weightedPick(["a", "b", "c"], [0, 1, 0], () => 0.5)
    expect(picked).toBe("b")
  })

  test("all-zero weights still returns an item", () => {
    const picked = weightedPick(["a", "b"], [0, 0], () => 0)
    expect(["a", "b"]).toContain(picked)
  })

  test("distribution follows the weights", () => {
    const counts: Record<string, number> = { a: 0, b: 0 }
    let seed = 0
    const rng = () => {
      seed = (seed + 0.1) % 1
      return seed
    }
    for (let i = 0; i < 1000; i++) {
      counts[weightedPick(["a", "b"], [3, 1], rng)]++
    }
    // ~75% a, ~25% b
    expect(counts.a).toBeGreaterThan(counts.b)
  })
})

describe("daysSince", () => {
  test("null → infinity", () => {
    expect(daysSince(null, NOW)).toBe(Number.POSITIVE_INFINITY)
  })

  test("counts elapsed days", () => {
    expect(daysSince(new Date(NOW.getTime() - 3 * DAY), NOW)).toBeCloseTo(3, 5)
  })
})
