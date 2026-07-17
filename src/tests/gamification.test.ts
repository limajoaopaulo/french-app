import { describe, expect, test } from "vitest"
import { userTier } from "@/lib/points"
import { cefrLabel } from "@/lib/levels"

describe("userTier", () => {
  test("0 XP → bottom tier (apprentice)", () => {
    const t = userTier(0)
    expect(t.name).toBe("apprentice")
    expect(t.min).toBe(0)
    expect(t.nextMin).toBe(100)
  })

  test("just below threshold stays at lower tier", () => {
    const t = userTier(99)
    expect(t.name).toBe("apprentice")
  })

  test("at threshold flips to next tier", () => {
    const t = userTier(100)
    expect(t.name).toBe("initiate")
    expect(t.min).toBe(100)
    expect(t.nextMin).toBe(500)
  })

  test("between adept and master", () => {
    const t = userTier(1500)
    expect(t.name).toBe("adept")
    expect(t.min).toBe(500)
    expect(t.nextMin).toBe(2000)
  })

  test("at top tier → nextMin null", () => {
    const t = userTier(10000)
    expect(t.name).toBe("sage")
    expect(t.nextMin).toBeNull()
  })
})

describe("cefrLabel", () => {
  test("integer levels → CEFR letters", () => {
    expect(cefrLabel(1)).toBe("A1")
    expect(cefrLabel(2)).toBe("A2")
    expect(cefrLabel(3)).toBe("B1")
    expect(cefrLabel(4)).toBe("B2")
    expect(cefrLabel(5)).toBe("C1")
  })

  test("decimal levels floor to band", () => {
    expect(cefrLabel(2.43)).toBe("A2")
    expect(cefrLabel(2.99)).toBe("A2")
    expect(cefrLabel(3.0)).toBe("B1")
    expect(cefrLabel(4.7)).toBe("B2")
  })

  test("0 (no cards) renders dash placeholder", () => {
    expect(cefrLabel(0)).toBe("—")
  })

  test("clamps above C1", () => {
    expect(cefrLabel(6.5)).toBe("C1")
  })
})
