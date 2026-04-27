import { readFileSync } from "node:fs"
import { resolve } from "node:path"

interface SeedQuestion {
  id: string
  domain: string
  sub: string
  level: number
  pattern: string
  cue_type: string
}

interface Taxonomy {
  domains: Record<
    string,
    {
      label: string
      subs: Record<string, { patterns?: string[] }>
    }
  >
  default_active: Record<string, string[]>
}

const TARGET_PER_BUCKET = 5
const LEVEL_LABELS = ["", "A1", "A2", "B1", "B2", "C1"]

const BOSS_COMPOSITION: Record<number, Record<number, number>> = {
  2: { 2: 20 },
  3: { 2: 10, 3: 20 },
  4: { 2: 10, 3: 15, 4: 20 },
  5: { 2: 10, 3: 15, 4: 20, 5: 25 },
}

function readJson<T>(relPath: string): T {
  return JSON.parse(readFileSync(resolve(process.cwd(), relPath), "utf8")) as T
}

function main() {
  const taxonomy = readJson<Taxonomy>("src/data/taxonomy.json")
  const seed = readJson<{ questions: SeedQuestion[] }>("src/data/seed-sample.json")
  const questions = seed.questions

  const bucketCount = new Map<string, number>()
  const cueTypeCount: Record<string, number> = {}
  for (const q of questions) {
    const key = `${q.domain}|${q.sub}|${q.pattern}|${q.level}`
    bucketCount.set(key, (bucketCount.get(key) ?? 0) + 1)
    cueTypeCount[q.cue_type] = (cueTypeCount[q.cue_type] ?? 0) + 1
  }

  const total = questions.length
  console.log(`Total questions: ${total}`)
  console.log(`MVP target: ~1,050 (5 per populated bucket)`)
  console.log(`Progress:   ${((total / 1050) * 100).toFixed(1)}% of MVP`)
  console.log()

  console.log("Cue-type mix (target: intent_en 40% / situation_fr 30% / micro_intent_fr 15% / gap_fr 15%)")
  for (const t of ["intent_en", "situation_fr", "micro_intent_fr", "gap_fr"]) {
    const n = cueTypeCount[t] ?? 0
    const pct = total > 0 ? ((n / total) * 100).toFixed(1) : "0.0"
    console.log(`  ${t.padEnd(18)} ${String(n).padStart(4)}  (${pct}%)`)
  }
  const known = new Set(["intent_en", "situation_fr", "micro_intent_fr", "gap_fr"])
  for (const [t, n] of Object.entries(cueTypeCount)) {
    if (!known.has(t)) {
      const pct = ((n / total) * 100).toFixed(1)
      console.log(`  ${t.padEnd(18)} ${String(n).padStart(4)}  (${pct}%) [unknown cue_type]`)
    }
  }
  console.log()

  console.log("Per-sub coverage:")
  for (const [domain, dMeta] of Object.entries(taxonomy.domains)) {
    console.log(`\n  [${domain}]`)
    for (const [sub, sMeta] of Object.entries(dMeta.subs)) {
      const patterns = sMeta.patterns ?? []
      let subTotal = 0
      const byLevel: Record<number, number> = {}
      for (const p of patterns) {
        for (let lvl = 1; lvl <= 5; lvl++) {
          const n = bucketCount.get(`${domain}|${sub}|${p}|${lvl}`) ?? 0
          subTotal += n
          byLevel[lvl] = (byLevel[lvl] ?? 0) + n
        }
      }
      const lvlStr = [1, 2, 3, 4, 5]
        .map((l) => `${LEVEL_LABELS[l]}:${byLevel[l] ?? 0}`)
        .join(" ")
      console.log(`    ${sub.padEnd(22)} total=${String(subTotal).padStart(3)}  ${lvlStr}`)
    }
  }

  console.log(`\nPopulated buckets below target (${TARGET_PER_BUCKET} Q):`)
  const deficits: Array<{ domain: string; sub: string; pattern: string; level: number; count: number }> = []
  for (const [domain, dMeta] of Object.entries(taxonomy.domains)) {
    for (const [sub, sMeta] of Object.entries(dMeta.subs)) {
      for (const pattern of sMeta.patterns ?? []) {
        for (let level = 1; level <= 5; level++) {
          const n = bucketCount.get(`${domain}|${sub}|${pattern}|${level}`) ?? 0
          if (n > 0 && n < TARGET_PER_BUCKET) {
            deficits.push({ domain, sub, pattern, level, count: n })
          }
        }
      }
    }
  }
  deficits.sort((a, b) => a.count - b.count || a.sub.localeCompare(b.sub))
  if (deficits.length === 0) {
    console.log("  All populated buckets meet the target.")
  } else {
    for (const d of deficits) {
      console.log(
        `  ${String(d.count).padStart(2)}/${TARGET_PER_BUCKET}  ${d.domain} / ${d.sub} / ${d.pattern} / ${LEVEL_LABELS[d.level]}`,
      )
    }
  }

  console.log("\nBoss feasibility (per domain — enough Q at each required level):")
  const byDomainLevel = new Map<string, number>()
  for (const q of questions) {
    const key = `${q.domain}|${q.level}`
    byDomainLevel.set(key, (byDomainLevel.get(key) ?? 0) + 1)
  }
  for (const domain of Object.keys(taxonomy.domains)) {
    for (const bossLvl of [2, 3, 4, 5]) {
      const needs = BOSS_COMPOSITION[bossLvl]
      let ok = true
      const parts: string[] = []
      for (const [reqLvl, reqN] of Object.entries(needs)) {
        const have = byDomainLevel.get(`${domain}|${reqLvl}`) ?? 0
        const pass = have >= reqN
        if (!pass) ok = false
        parts.push(`${LEVEL_LABELS[Number(reqLvl)]}:${have}/${reqN}${pass ? "" : " X"}`)
      }
      console.log(
        `  ${ok ? "OK  " : "FAIL"}  ${domain.padEnd(10)} ${LEVEL_LABELS[bossLvl]} boss — ${parts.join("  ")}`,
      )
    }
  }
}

main()
