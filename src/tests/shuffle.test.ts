import { describe, expect, test } from "vitest"
import { shuffleOptions } from "@/lib/shuffle"

const BASE = {
  id: "test_q",
  options: ["alpha", "beta", "gamma", "delta"],
  correctIndex: 0,
}

describe("shuffleOptions", () => {
  test("correct_index is uniform across 1000 trials (±3%)", () => {
    const counts = [0, 0, 0, 0]
    const correctText = BASE.options[BASE.correctIndex]

    for (let i = 0; i < 1000; i++) {
      const s = shuffleOptions(BASE)
      counts[s.correctIndex]++
      expect(s.options[s.correctIndex]).toBe(correctText)
    }

    for (const c of counts) {
      expect(c).toBeGreaterThanOrEqual(220)
      expect(c).toBeLessThanOrEqual(280)
    }
  })

  test("does not mutate the input question", () => {
    const before = JSON.parse(JSON.stringify(BASE))
    shuffleOptions(BASE)
    expect(BASE).toEqual(before)
  })

  test("preserves all options — no dupes, no drops", () => {
    for (let i = 0; i < 50; i++) {
      const s = shuffleOptions(BASE)
      expect([...s.options].sort()).toEqual([...BASE.options].sort())
    }
  })

  test("preserves all other fields on the question object", () => {
    const q = { ...BASE, cue: "hello", level: 3 }
    const s = shuffleOptions(q)
    expect(s.cue).toBe("hello")
    expect(s.level).toBe(3)
    expect(s.id).toBe("test_q")
  })
})
