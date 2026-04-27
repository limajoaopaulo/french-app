import { describe, expect, test } from "vitest"
import { diffOptions } from "@/lib/option-diff"

describe("diffOptions", () => {
  test("shared suffix only — emphasizes the differing prefix", () => {
    const result = diffOptions(["ai mangé", "as mangé", "ont mangé", "avons mangé"])
    expect(result).toHaveLength(4)
    // Common suffix " mangé" (6 chars). All options end with it.
    for (const segments of result) {
      const dimmed = segments.filter((s) => !s.emphasize).map((s) => s.text).join("")
      expect(dimmed).toBe(" mangé")
    }
    expect(result[0].find((s) => s.emphasize)?.text).toBe("ai")
    expect(result[1].find((s) => s.emphasize)?.text).toBe("as")
    expect(result[2].find((s) => s.emphasize)?.text).toBe("ont")
    expect(result[3].find((s) => s.emphasize)?.text).toBe("avons")
  })

  test("shared prefix only — emphasizes the differing suffix", () => {
    const result = diffOptions(["pourriez-vous", "pourrait-il", "pourrais-tu", "pourraient-elles"])
    // Common prefix "pourr" (5 chars). All start with it.
    for (const segments of result) {
      const dimmed = segments.filter((s) => !s.emphasize).map((s) => s.text).join("")
      expect(dimmed.startsWith("pourr")).toBe(true)
    }
  })

  test("no overlap — every option fully emphasized", () => {
    const result = diffOptions(["suis", "es", "est", "ai"])
    expect(result).toHaveLength(4)
    for (const segments of result) {
      expect(segments).toHaveLength(1)
      expect(segments[0].emphasize).toBe(true)
    }
    expect(result[0][0].text).toBe("suis")
    expect(result[3][0].text).toBe("ai")
  })

  test("identical options — emphasize all (no infinite-emphasis crash)", () => {
    const result = diffOptions(["mange", "mange", "mange", "mange"])
    expect(result).toHaveLength(4)
    // totalCommon === minOptionLen, so falls back to emphasize-all
    for (const segments of result) {
      expect(segments).toHaveLength(1)
      expect(segments[0].text).toBe("mange")
      expect(segments[0].emphasize).toBe(true)
    }
  })

  test("short common parts (<4 chars) — no diff stripping", () => {
    // Common prefix "a" (1 char), no shared suffix → totalCommon=1 < MIN
    const result = diffOptions(["ai", "as", "au", "ar"])
    for (const segments of result) {
      expect(segments).toHaveLength(1)
      expect(segments[0].emphasize).toBe(true)
    }
  })

  test("both prefix and suffix shared — emphasizes the middle", () => {
    const result = diffOptions(["abc1xyz", "abc2xyz", "abc3xyz", "abc4xyz"])
    // Common prefix "abc" (3), common suffix "xyz" (3), middle = the digit.
    expect(result[0].map((s) => s.text)).toEqual(["abc", "1", "xyz"])
    expect(result[1].map((s) => s.text)).toEqual(["abc", "2", "xyz"])
    expect(result[0].map((s) => s.emphasize)).toEqual([false, true, false])
  })

  test("one option's middle would be empty — fall back to emphasize-all", () => {
    // "je parle" is fully consumed by prefix+suffix; we don't render that as
    // an empty highlight.
    const result = diffOptions(["je parle", "je parles", "je parlent", "je parlez"])
    for (const segments of result) {
      expect(segments).toHaveLength(1)
      expect(segments[0].emphasize).toBe(true)
    }
  })

  test("empty input — empty output", () => {
    expect(diffOptions([])).toEqual([])
  })

  test("single option — emphasized", () => {
    const result = diffOptions(["alone"])
    expect(result).toEqual([[{ text: "alone", emphasize: true }]])
  })
})
