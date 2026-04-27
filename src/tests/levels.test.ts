import { describe, expect, test } from "vitest"
import { State } from "@/lib/fsrs"
import {
  subLevelFromCards,
  patternMastery,
  cardsToNextLevel,
  type CardForLevel,
} from "@/lib/levels"

function card(level: number, stability: number, opts: Partial<CardForLevel> = {}): CardForLevel {
  return {
    level,
    stability,
    difficulty: 5,
    state: stability > 0 ? State.Review : State.New,
    scheduledDays: 0,
    learningSteps: 0,
    reps: stability > 0 ? 1 : 0,
    lapses: 0,
    lastReview: stability > 0 ? new Date("2026-01-01T00:00:00Z") : null,
    dueAt: stability > 0 ? new Date("2026-01-11T00:00:00Z") : null,
    ...opts,
  }
}

describe("subLevelFromCards", () => {
  test("returns 0 on empty input", () => {
    expect(subLevelFromCards([])).toBe(0)
  })

  test("returns 0 when no level threshold reached (insufficient stable cards)", () => {
    const cards = [card(2, 0.5), card(2, 1.0)]
    expect(subLevelFromCards(cards)).toBe(0)
  })

  test("reaches A1 (level 1) with 5 cards at any stability", () => {
    const cards = [card(1, 0.1), card(1, 0.1), card(1, 0.1), card(1, 0.1), card(1, 0.1)]
    expect(subLevelFromCards(cards)).toBeGreaterThanOrEqual(1)
    expect(subLevelFromCards(cards)).toBeLessThan(2)
  })

  test("reaches A2 (level 2) with 5 A2-or-easier cards stable >= 2 days", () => {
    const cards = Array.from({ length: 5 }, () => card(2, 3))
    const lvl = subLevelFromCards(cards)
    expect(lvl).toBeGreaterThanOrEqual(2)
    expect(lvl).toBeLessThan(3)
  })

  test("interpolates: 5 cards at level 2 with stability halfway to B1 threshold yields ~2.5", () => {
    // T_2=2, T_3=7. Mid = 4.5d. Mean ratio = (4.5-2)/(7-2) = 0.5
    const cards = Array.from({ length: 5 }, () => card(2, 4.5))
    const lvl = subLevelFromCards(cards)
    expect(lvl).toBeGreaterThan(2.4)
    expect(lvl).toBeLessThan(2.7)
  })

  test("saturates at 5 (C1) when all thresholds met", () => {
    const cards = Array.from({ length: 5 }, () => card(5, 100))
    expect(subLevelFromCards(cards)).toBe(5)
  })

  test("level cap respects question.level: 5 cards at A2 stable for years still cap at 2.x (not 5)", () => {
    const cards = Array.from({ length: 5 }, () => card(2, 1000))
    const lvl = subLevelFromCards(cards)
    expect(lvl).toBeLessThanOrEqual(3)
  })
})

describe("cardsToNextLevel", () => {
  test("returns null when already at C1 (level 5)", () => {
    const cards = Array.from({ length: 5 }, () => card(5, 100))
    expect(cardsToNextLevel(cards, 5)).toBeNull()
  })

  test("counts how many more cards need to reach the next-level threshold", () => {
    // Current sub level ~A2 (2.x). Next level is B1, T_3 = 7d.
    // 2 cards already at level 3 with stability ≥ 7. Need 3 more.
    const cards = [
      card(3, 8),
      card(3, 10),
      card(3, 1), // not enough stability
      card(2, 100), // wrong level (A2)
      card(3, 0.5),
    ]
    const result = cardsToNextLevel(cards, 2.4)
    expect(result?.nextLevel).toBe(3)
    expect(result?.needed).toBe(3)
  })

  test("needed clamps at 0 when 5+ cards already qualify", () => {
    const cards = Array.from({ length: 7 }, () => card(3, 10))
    const result = cardsToNextLevel(cards, 2.4)
    expect(result?.needed).toBe(0)
  })

  test("from level 0 (no cards stable), needs 5 A1-eligible cards", () => {
    const result = cardsToNextLevel([], 0)
    expect(result?.nextLevel).toBe(1)
    expect(result?.needed).toBe(5)
  })
})

describe("patternMastery", () => {
  test("returns one entry per distinct pattern", () => {
    const cards = [
      { ...card(2, 5), pattern: "p1" },
      { ...card(2, 5), pattern: "p1" },
      { ...card(2, 5), pattern: "p2" },
    ]
    const m = patternMastery(cards, new Date("2026-01-02T00:00:00Z"))
    expect(m).toHaveLength(2)
    const p1 = m.find((x) => x.pattern === "p1")
    expect(p1?.cardCount).toBe(2)
  })

  test("meanR is 0 for an unreviewed (cold) pattern", () => {
    const cards = [{ ...card(2, 0), pattern: "cold" }]
    const m = patternMastery(cards, new Date())
    expect(m[0].meanR).toBe(0)
  })

  test("meanStability is the average of card stabilities", () => {
    const cards = [
      { ...card(2, 2), pattern: "p" },
      { ...card(2, 8), pattern: "p" },
    ]
    const m = patternMastery(cards, new Date("2026-01-02T00:00:00Z"))
    expect(m[0].meanStability).toBe(5)
  })
})
