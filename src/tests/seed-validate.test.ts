import { describe, expect, test } from "vitest"
import { z } from "zod"
import frSeed from "../data/fr/seed.json"
import frFacets from "../data/fr/facets.json"
import ptSeed from "../data/pt/seed.json"
import ptFacets from "../data/pt/facets.json"

// A question is valid in EITHER the new tag format (tags + format) or the legacy
// format (domain/sub/cue_type). Legacy questions are treated as one focus tag
// (domain→facet, sub→tag) so the same checks apply during the transition.

const TagRefSchema = z.object({
  facet: z.enum(["grammar", "topic"]),
  tag: z.string().min(1),
  role: z.enum(["focus", "context"]),
})

const NewQuestionSchema = z.object({
  id: z.string().min(1),
  format: z.string().min(1),
  level: z.number().int().min(1).max(5),
  cue: z.string().min(1),
  blankHint: z.string().min(1).nullable().optional(),
  translation: z.string().min(1).nullable().optional(),
  tags: z.array(TagRefSchema).min(1),
  options: z.array(z.string().min(1)).length(4),
  correct_index: z.literal(0),
  explanation: z.string().min(1),
  register: z.string().min(1).optional(),
})

const LegacyQuestionSchema = z.object({
  id: z.string().min(1),
  domain: z.enum(["grammar", "vocabulary"]),
  sub: z.string().min(1),
  level: z.number().int().min(1).max(5),
  pattern: z.string().min(1),
  cue_type: z.string().min(1),
  cue: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  correct_index: z.literal(0),
  explanation: z.string().min(1),
  register: z.string().min(1).optional(),
})

type Facets = {
  facets: Record<"grammar" | "topic", { tags: Record<string, unknown> }>
}
type Seed = { questions: unknown[] }
type NormTag = { facet: "grammar" | "topic"; tag: string; role: "focus" | "context" }

function knownTags(f: Facets): Set<string> {
  const s = new Set<string>()
  for (const facet of ["grammar", "topic"] as const) {
    for (const tag of Object.keys(f.facets[facet].tags)) s.add(`${facet}::${tag}`)
  }
  return s
}

function normalize(q: unknown): {
  id: string
  format: string
  cue: string
  tags: NormTag[]
  translation?: string
} | null {
  const asNew = NewQuestionSchema.safeParse(q)
  if (asNew.success) {
    return {
      id: asNew.data.id,
      format: asNew.data.format,
      cue: asNew.data.cue,
      tags: asNew.data.tags,
      translation: asNew.data.translation ?? undefined,
    }
  }
  const asLegacy = LegacyQuestionSchema.safeParse(q)
  if (asLegacy.success) {
    const facet = asLegacy.data.domain === "grammar" ? "grammar" : "topic"
    return {
      id: asLegacy.data.id,
      format: asLegacy.data.cue_type,
      cue: asLegacy.data.cue,
      tags: [{ facet, tag: asLegacy.data.sub, role: "focus" }],
    }
  }
  return null
}

function runChecks(label: string, seed: Seed, facets: Facets) {
  describe(`${label} seed`, () => {
    const known = knownTags(facets)
    const parsed = seed.questions.map((q, i) => {
      const n = normalize(q)
      if (!n) throw new Error(`${label} question index ${i} matches neither schema`)
      return n
    })

    test("bank is non-empty", () => {
      expect(parsed.length).toBeGreaterThan(0)
    })

    test("every question has at least one focus tag", () => {
      for (const q of parsed) {
        expect(
          q.tags.some((t) => t.role === "focus"),
          `${q.id} has no focus tag`,
        ).toBe(true)
      }
    })

    test("no duplicate (facet,tag) within a question", () => {
      for (const q of parsed) {
        const keys = q.tags.map((t) => `${t.facet}::${t.tag}`)
        expect(new Set(keys).size, `${q.id} has duplicate tags`).toBe(keys.length)
      }
    })

    test("cloze questions contain the ___ blank marker", () => {
      for (const q of parsed) {
        if (q.format === "cloze") {
          expect(q.cue.includes("___"), `${q.id} is cloze but has no ___`).toBe(true)
        }
      }
    })

    test("ids are unique", () => {
      const ids = parsed.map((q) => q.id)
      const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
      expect(dupes, `duplicate ids: ${[...new Set(dupes)].join(", ")}`).toEqual([])
    })

    // NEW-format questions must reference tags that exist in the taxonomy.
    // (Legacy questions use old sub keys and are exempt until reauthored.)
    test("new-format tags exist in the taxonomy", () => {
      for (let i = 0; i < seed.questions.length; i++) {
        const raw = seed.questions[i] as { tags?: unknown; id?: string }
        if (!raw.tags) continue
        const n = parsed.find((p) => p.id === raw.id)!
        for (const t of n.tags) {
          expect(
            known.has(`${t.facet}::${t.tag}`),
            `${n.id} references unknown tag ${t.facet}::${t.tag}`,
          ).toBe(true)
        }
      }
    })
  })
}

runChecks("fr", frSeed as Seed, frFacets as Facets)
runChecks("pt", ptSeed as Seed, ptFacets as Facets)
