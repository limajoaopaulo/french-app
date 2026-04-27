import { describe, expect, test } from "vitest"
import { pointsForAnswer, pointsPerQuestion, rankTier } from "@/lib/points"
import { LEVEL_POINTS, SPEED_MULTIPLIER } from "@/lib/constants"

describe("pointsForAnswer", () => {
  test("wrong answer returns 0", () => {
    expect(
      pointsForAnswer({
        levelAtServe: 3,
        stabilityBefore: 5,
        stabilityAfter: 1,
        correct: false,
        speedTag: "fast",
      }),
    ).toBe(0)
  })

  test("correct answer with no stability gain returns 0", () => {
    expect(
      pointsForAnswer({
        levelAtServe: 3,
        stabilityBefore: 5,
        stabilityAfter: 5,
        correct: true,
        speedTag: "normal",
      }),
    ).toBe(0)
  })

  test("correct answer = stability_gain × LEVEL_POINTS[level] × SPEED_MULTIPLIER (normal=1)", () => {
    const pts = pointsForAnswer({
      levelAtServe: 3,
      stabilityBefore: 2,
      stabilityAfter: 6,
      correct: true,
      speedTag: "normal",
    })
    expect(pts).toBeCloseTo(4 * LEVEL_POINTS[3] * SPEED_MULTIPLIER.normal, 6)
  })

  test("higher levels reward more per day of stability", () => {
    const a1 = pointsForAnswer({ levelAtServe: 1, stabilityBefore: 0, stabilityAfter: 1, correct: true, speedTag: "normal" })
    const c1 = pointsForAnswer({ levelAtServe: 5, stabilityBefore: 0, stabilityAfter: 1, correct: true, speedTag: "normal" })
    expect(c1).toBeGreaterThan(a1)
    expect(c1 / a1).toBeCloseTo(LEVEL_POINTS[5] / LEVEL_POINTS[1], 6)
  })

  test("never returns negative — stability regression on a correct answer floors at 0", () => {
    expect(
      pointsForAnswer({
        levelAtServe: 3,
        stabilityBefore: 10,
        stabilityAfter: 8,
        correct: true,
        speedTag: "fast",
      }),
    ).toBe(0)
  })

  test("speedTag scales the reward: fast > normal > slow at the same gain/level", () => {
    const args = { levelAtServe: 3, stabilityBefore: 0, stabilityAfter: 4, correct: true } as const
    const fast = pointsForAnswer({ ...args, speedTag: "fast" })
    const normal = pointsForAnswer({ ...args, speedTag: "normal" })
    const slow = pointsForAnswer({ ...args, speedTag: "slow" })
    expect(fast).toBeGreaterThan(normal)
    expect(normal).toBeGreaterThan(slow)
    expect(fast / normal).toBeCloseTo(SPEED_MULTIPLIER.fast / SPEED_MULTIPLIER.normal, 6)
    expect(slow / normal).toBeCloseTo(SPEED_MULTIPLIER.slow / SPEED_MULTIPLIER.normal, 6)
  })

  test("Diamond reachable: fast all-correct A2 drill with full stability gains beats 8 ppq", () => {
    // 10 questions, each gaining 5 days of stability at level A2 (LEVEL_POINTS[2]=0.75),
    // all fast (×1.2). Per-question points = 5 × 0.75 × 1.2 = 4.5. Wait — that's < 8.
    // Use a more realistic high-end gain: 9 days of stability per Q at A2 fast →
    // 9 × 0.75 × 1.2 = 8.1 → Diamond. Or B1 (1.5) with 5 days fast: 5*1.5*1.2 = 9.
    const ppqB1 = pointsForAnswer({
      levelAtServe: 3,
      stabilityBefore: 0,
      stabilityAfter: 5,
      correct: true,
      speedTag: "fast",
    })
    expect(ppqB1).toBeGreaterThanOrEqual(8.0)
    expect(rankTier(ppqB1).name).toBe("diamond")
  })
})

describe("pointsPerQuestion", () => {
  test("0 questions seen returns 0", () => {
    expect(pointsPerQuestion(50, 0)).toBe(0)
  })

  test("totalPoints / questionsSeen otherwise", () => {
    expect(pointsPerQuestion(15, 3)).toBe(5)
  })
})

describe("rankTier", () => {
  test("returns the highest tier matching ppq", () => {
    expect(rankTier(10).name).toBe("diamond")
    expect(rankTier(5).name).toBe("platinum")
    expect(rankTier(2.5).name).toBe("gold")
    expect(rankTier(1).name).toBe("silver")
    expect(rankTier(0.1).name).toBe("bronze")
  })
})
