import { describe, expect, it } from "vitest"
import { bossMedalFromMisses, buildBossComposition, isBossDefeat } from "@/lib/boss"
import { BOSSES } from "@/lib/constants"

describe("buildBossComposition", () => {
  it("preserves total count and level distribution for every boss level", () => {
    for (const level of BOSSES.levels) {
      const expected = BOSSES.composition[String(level)]
      const total = expected.reduce((s, b) => s + b.count, 0)
      const queue = buildBossComposition(level, mulberry32(42))
      expect(queue).toHaveLength(total)
      for (const block of expected) {
        const n = queue.filter((x) => x === block.level).length
        expect(n).toBe(block.count)
      }
    }
  })

  it("shuffles (is not strictly sequential) for multi-block bosses", () => {
    // With seed=1, a B2 boss composition (10,15,20) should not be a block of 10 × 2 followed by 15 × 3 ...
    const q = buildBossComposition(4, mulberry32(1))
    const firstTen = q.slice(0, 10)
    const allTwos = firstTen.every((x) => x === 2)
    expect(allTwos).toBe(false)
  })

  it("throws for unknown level", () => {
    expect(() => buildBossComposition(99)).toThrow()
  })
})

describe("bossMedalFromMisses", () => {
  it("gold at 0 miss, silver at 1, bronze at 2", () => {
    expect(bossMedalFromMisses(0)?.tier).toBe("gold")
    expect(bossMedalFromMisses(1)?.tier).toBe("silver")
    expect(bossMedalFromMisses(2)?.tier).toBe("bronze")
  })

  it("returns null when defeated (3+ misses)", () => {
    expect(bossMedalFromMisses(3)).toBeNull()
    expect(bossMedalFromMisses(5)).toBeNull()
  })
})

describe("isBossDefeat", () => {
  it("triggers only strictly beyond maxMisses", () => {
    expect(isBossDefeat(0)).toBe(false)
    expect(isBossDefeat(2)).toBe(false)
    expect(isBossDefeat(3)).toBe(true)
  })
})

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
