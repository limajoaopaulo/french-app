import { describe, expect, test } from "vitest"
import { computeBossProgress, type SubAggregate } from "@/lib/progression"
import { userTier } from "@/lib/points"
import { cefrLabel } from "@/lib/levels"

function sub(
  domain: string,
  key: string,
  subLevel: number,
  isActive = true,
): SubAggregate {
  return {
    domain,
    sub: key,
    isActive,
    subLevel,
    meanR: 0,
    lowR: 0,
    total: 0,
    cold: 0,
  }
}

describe("computeBossProgress", () => {
  test("no active subs in domain → ready=0, total=0, bottleneck=null", () => {
    const aggs = [
      sub("grammar", "conjugation", 3, false),
      sub("vocabulary", "daily", 2, true),
    ]
    const p = computeBossProgress(aggs, "grammar", 2)
    expect(p).toEqual({ ready: 0, total: 0, bottleneck: null })
  })

  test("all active subs at or above level → ready=total, no bottleneck", () => {
    const aggs = [
      sub("grammar", "conjugation", 3.2),
      sub("grammar", "pronouns", 2.5),
      sub("grammar", "subjunctive", 2.0),
    ]
    const p = computeBossProgress(aggs, "grammar", 2)
    expect(p.ready).toBe(3)
    expect(p.total).toBe(3)
    expect(p.bottleneck).toBeNull()
  })

  test("mixed → bottleneck is the lowest blocker", () => {
    const aggs = [
      sub("grammar", "conjugation", 2.5),
      sub("grammar", "pronouns", 1.4),
      sub("grammar", "subjunctive", 1.8),
      sub("grammar", "negation", 0.7),
    ]
    const p = computeBossProgress(aggs, "grammar", 2)
    expect(p.ready).toBe(1)
    expect(p.total).toBe(4)
    expect(p.bottleneck).toEqual({ sub: "negation", subLevel: 0.7 })
  })

  test("ignores inactive subs and other domains", () => {
    const aggs = [
      sub("grammar", "conjugation", 1.0),
      sub("grammar", "pronouns", 1.0, false),
      sub("vocabulary", "daily", 0.5),
    ]
    const p = computeBossProgress(aggs, "grammar", 2)
    expect(p.total).toBe(1)
    expect(p.ready).toBe(0)
    expect(p.bottleneck?.sub).toBe("conjugation")
  })

  test("single active sub already above level", () => {
    const p = computeBossProgress(
      [sub("vocabulary", "daily", 4.0)],
      "vocabulary",
      3,
    )
    expect(p).toEqual({
      ready: 1,
      total: 1,
      bottleneck: null,
    })
  })
})

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
