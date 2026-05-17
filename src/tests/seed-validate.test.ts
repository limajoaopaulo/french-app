import { describe, expect, test } from "vitest"
import { z } from "zod"
import deSeed from "../data/de/seed.json"
import deTaxonomy from "../data/de/taxonomy.json"
import esSeed from "../data/es/seed.json"
import esTaxonomy from "../data/es/taxonomy.json"
import frSeed from "../data/fr/seed.json"
import frTaxonomy from "../data/fr/taxonomy.json"
import itSeed from "../data/it/seed.json"
import itTaxonomy from "../data/it/taxonomy.json"
import ptSeed from "../data/pt/seed.json"
import ptTaxonomy from "../data/pt/taxonomy.json"

// Shape shared by FR and PT seed files. Every language's seed bank must pass.
const QuestionSchema = z.object({
  id: z.string().min(1),
  domain: z.enum(["grammar", "vocabulary"]),
  sub: z.string().min(1),
  level: z.number().int().min(1).max(5),
  pattern: z.string().min(1),
  counterpart: z.string().min(1).optional(),
  cue_type: z.string().min(1),
  cue: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  correct_index: z.literal(0),
  explanation: z.string().min(1),
  register: z.enum(["casual", "neutral", "formal"]).optional(),
})

type Taxonomy = {
  domains: Record<
    string,
    { subs: Record<string, { patterns: string[] }> }
  >
}
type Seed = { questions: unknown[] }

function collectPatterns(tax: Taxonomy): Map<string, Set<string>> {
  // domain/sub -> allowed pattern keys
  const byDomainSub = new Map<string, Set<string>>()
  for (const [d, dv] of Object.entries(tax.domains)) {
    for (const [s, sv] of Object.entries(dv.subs)) {
      byDomainSub.set(`${d}/${s}`, new Set(sv.patterns))
    }
  }
  return byDomainSub
}

function runChecks(label: string, seed: Seed, tax: Taxonomy) {
  describe(`${label} seed`, () => {
    const parsed = seed.questions.map((q, i) => {
      const r = QuestionSchema.safeParse(q)
      if (!r.success) {
        throw new Error(
          `${label} question index ${i} failed schema: ${r.error.message}`,
        )
      }
      return r.data
    })

    const byDomainSub = collectPatterns(tax)

    test("every question matches the shared schema", () => {
      expect(parsed.length).toBeGreaterThan(0)
    })

    test("every domain/sub exists in the language's taxonomy", () => {
      for (const q of parsed) {
        expect(
          byDomainSub.has(`${q.domain}/${q.sub}`),
          `${q.id} references unknown ${q.domain}/${q.sub}`,
        ).toBe(true)
      }
    })

    test("every pattern is declared in the sub's pattern list", () => {
      for (const q of parsed) {
        const allowed = byDomainSub.get(`${q.domain}/${q.sub}`)!
        expect(
          allowed.has(q.pattern),
          `${q.id} pattern "${q.pattern}" not declared in ${q.domain}/${q.sub}`,
        ).toBe(true)
      }
    })

    test("every counterpart (if set) is a declared pattern somewhere in the taxonomy", () => {
      const all = new Set<string>()
      for (const set of byDomainSub.values()) for (const p of set) all.add(p)
      for (const q of parsed) {
        if (q.counterpart) {
          expect(
            all.has(q.counterpart),
            `${q.id} counterpart "${q.counterpart}" not found in taxonomy`,
          ).toBe(true)
        }
      }
    })

    test("ids are unique", () => {
      const ids = parsed.map((q) => q.id)
      const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
      expect(dupes, `duplicate ids: ${[...new Set(dupes)].join(", ")}`).toEqual(
        [],
      )
    })

    test("options are unique within each question", () => {
      for (const q of parsed) {
        const uniq = new Set(q.options)
        expect(
          uniq.size,
          `${q.id} has duplicate options: ${q.options.join(" | ")}`,
        ).toBe(4)
      }
    })
  })
}

runChecks("fr", frSeed as Seed, frTaxonomy as Taxonomy)
runChecks("pt", ptSeed as Seed, ptTaxonomy as Taxonomy)
runChecks("de", deSeed as Seed, deTaxonomy as Taxonomy)
runChecks("it", itSeed as Seed, itTaxonomy as Taxonomy)
runChecks("es", esSeed as Seed, esTaxonomy as Taxonomy)
