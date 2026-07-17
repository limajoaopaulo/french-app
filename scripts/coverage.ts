import { readFileSync } from "node:fs"
import { resolve } from "node:path"

// Reachability floor: subLevelFromCards needs >=5 focus cards at level>=L to
// graduate a tag to L. Flag tag/level buckets under this floor, but ONLY within
// each tag's intended CEFR range (authoring targets) — flagging e.g. C1
// present-tense-of-être would be noise.
const FOCUS_FLOOR = 5
const LEVEL_LABELS = ["", "A1", "A2", "B1", "B2", "C1"]
const LANGS = ["fr", "pt"]

// FR intended level range per tag (min..max inclusive). Tags absent here are
// reported but not deficit-checked (e.g. all PT tags — PT is backfilled, not
// authored to the floor).
const FR_RANGES: Record<string, [number, number]> = {
  "grammar::present_etre_avoir": [1, 3], "grammar::present_reguliers": [1, 3],
  "grammar::present_irreguliers": [1, 4], "grammar::present_pronominaux": [1, 4],
  "grammar::passe_compose": [2, 4], "grammar::aux_avoir": [2, 4], "grammar::aux_etre": [2, 4],
  "grammar::accord_participe": [2, 5], "grammar::imparfait": [2, 4], "grammar::pc_vs_imparfait": [2, 5],
  "grammar::plus_que_parfait": [3, 5], "grammar::futur_proche": [1, 3], "grammar::futur_simple": [2, 4],
  "grammar::conditionnel": [2, 5], "grammar::subjonctif": [3, 5], "grammar::si_hypothese": [2, 5],
  "grammar::pronom_cod": [2, 4], "grammar::pronom_coi": [2, 4], "grammar::pronom_y_en": [2, 5],
  "grammar::pronom_combinaisons": [3, 5], "grammar::relatif_qui_que": [2, 4],
  "grammar::relatif_dont_ou_lequel": [3, 5], "grammar::prepositions_lieu": [1, 4],
  "grammar::prepositions_verbe": [2, 5], "grammar::articles_definis_indefinis": [1, 3],
  "grammar::article_partitif": [1, 4], "grammar::de_apres_negation": [2, 4],
  "grammar::negation_base": [1, 3], "grammar::negation_rien_personne": [2, 4], "grammar::ne_que": [3, 5],
  "grammar::accord_adjectif": [1, 4], "grammar::comparatif_superlatif": [2, 4],
  "grammar::discours_rapporte": [3, 5], "grammar::connecteurs_logiques": [3, 5],
  "topic::daily_routine": [1, 3], "topic::weather_time": [1, 3], "topic::clothing": [1, 3],
  "topic::shopping_courses": [1, 3], "topic::transport_daily": [1, 3], "topic::restaurant": [1, 4],
  "topic::food_ingredients": [1, 4], "topic::cooking_methods": [2, 4], "topic::home_rooms": [1, 3],
  "topic::furniture_objects": [1, 3], "topic::housing_admin": [2, 4], "topic::work_email": [2, 4],
  "topic::meetings": [2, 4], "topic::job_contract": [2, 4], "topic::body_health": [1, 3],
  "topic::symptoms_doctor": [2, 4], "topic::travel_booking": [2, 4], "topic::directions": [1, 3],
  "topic::emotions_feelings": [1, 4], "topic::family_relations": [1, 3], "topic::friendship_social": [2, 4],
  "topic::apologies_conflict": [2, 4], "topic::politeness": [1, 4], "topic::admin_bureaucracy": [2, 5],
  "topic::media_news": [3, 5], "topic::numbers_stats": [1, 4], "topic::idioms": [2, 5],
  "topic::register_formal": [2, 5],
}

interface TagRef {
  facet: "grammar" | "topic"
  tag: string
  role: "focus" | "context"
}
interface SeedQuestion {
  id: string
  level: number
  tags?: TagRef[]
  domain?: string
  sub?: string
}
interface Facets {
  facets: Record<"grammar" | "topic", { tags: Record<string, { frequency?: number }> }>
}

function readJson<T>(p: string): T {
  return JSON.parse(readFileSync(resolve(process.cwd(), p), "utf8")) as T
}

function tagsFor(q: SeedQuestion): TagRef[] {
  if (q.tags && q.tags.length > 0) return q.tags
  if (q.domain && q.sub) {
    const facet = q.domain === "grammar" ? "grammar" : "topic"
    return [{ facet, tag: q.sub, role: "focus" }]
  }
  return []
}

function main() {
  for (const lang of LANGS) {
    let facets: Facets
    let questions: SeedQuestion[]
    try {
      facets = readJson<Facets>(`src/data/${lang}/facets.json`)
      questions = readJson<{ questions: SeedQuestion[] }>(`src/data/${lang}/seed.json`).questions
    } catch {
      console.log(`[${lang}] missing facets.json or seed.json — skipped`)
      continue
    }
    const rangeChecked = lang === "fr"

    const focus = new Map<string, Record<number, number>>()
    for (const q of questions) {
      for (const t of tagsFor(q)) {
        if (t.role !== "focus") continue
        const key = `${t.facet}::${t.tag}`
        const row = focus.get(key) ?? {}
        row[q.level] = (row[q.level] ?? 0) + 1
        focus.set(key, row)
      }
    }

    console.log(`\n========== [${lang}] focus-question coverage ==========`)
    const deficits: string[] = []
    for (const facet of ["grammar", "topic"] as const) {
      const tags = Object.keys(facets.facets[facet]?.tags ?? {})
      console.log(`\n[${facet}] ${tags.length} tags`)
      for (const tag of tags) {
        const key = `${facet}::${tag}`
        const row = focus.get(key) ?? {}
        const total = Object.values(row).reduce((a, b) => a + b, 0)
        const range = FR_RANGES[key]
        const byLevel = [1, 2, 3, 4, 5]
          .map((l) => {
            const n = row[l] ?? 0
            const inRange = !rangeChecked || !range || (l >= range[0] && l <= range[1])
            const mark = inRange && n < FOCUS_FLOOR ? "!" : ""
            return `${LEVEL_LABELS[l]}:${n}${mark}`
          })
          .join(" ")
        const rng = range ? ` [${LEVEL_LABELS[range[0]]}-${LEVEL_LABELS[range[1]]}]` : ""
        console.log(`  ${tag.padEnd(28)} total=${String(total).padStart(3)}  ${byLevel}${rng}`)
        if (rangeChecked && range) {
          for (let l = range[0]; l <= range[1]; l++) {
            const n = row[l] ?? 0
            if (n < FOCUS_FLOOR) deficits.push(`${facet}/${tag}/${LEVEL_LABELS[l]}: ${n}/${FOCUS_FLOOR}`)
          }
        }
      }
    }

    if (rangeChecked) {
      console.log(`\n[${lang}] IN-RANGE tag/level buckets below the ${FOCUS_FLOOR}-focus floor: ${deficits.length}`)
      for (const d of deficits) console.log(`  ${d}`)
    } else {
      console.log(`\n[${lang}] (informational only — not authored to the floor)`)
    }
  }
}

main()
