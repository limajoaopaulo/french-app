// Loosened batch pass — applies broader cue rewrites with regex.
// Does NOT touch options (those need hand judgment per the agreed style).
//
// Cue rewrites (all guarded by length checks to avoid stripping too much):
//
//   1. "Tu (décris|expliques|...) X : Y"        → "Y"
//   2. "Tu (décris|expliques|...) que Y"        → "Y"
//   3. "Tu (décris|expliques|...) <content>"    → "<content>"  (if ≥30 chars)
//   4. "Dans (un|une) <ctx>, tu (verb) <Y>"     → "Dans <ctx>, <Y>"  (drops "tu verb")
//   5. "Pour <ctx>, tu (verb) <Y>"              → "Pour <ctx>, <Y>"
//   6. "Au/À la <place>, tu (verb) <Y>"         → "Au/À la <place>, <Y>"
//   7. "On t'<verb> X" / "Quelqu'un te <verb> X" stays — too contextual

import fs from "node:fs"

interface Question {
  id: string
  cue: string
  cue_type: string
  options: string[]
  correct_index: number
}
interface Seed { questions: Question[] }

const VERBS = "décris|décrivais|expliques|racontes|commentes|indiques|signales|informes|résumes|précises|annonces|réponds|dis|écris|rédiges|formules|déclares|fais\\s+remarquer"

const RE_COLON = new RegExp(`^Tu (?:${VERBS})\\b[^:]{4,}:\\s+(.+)$`, "i")
const RE_QUE = new RegExp(`^Tu (?:${VERBS})\\b\\s+(?:que |qu')\\s*(.+)$`, "i")
const RE_BARE = new RegExp(`^Tu (?:${VERBS})\\b\\s+(.+)$`, "i")
const RE_DANS_TU = new RegExp(`^(Dans (?:un|une|le|la|les|ce|cette|ces) [^,]+,)\\s+tu (?:${VERBS})\\b[^:]*?(?::\\s+(.+)| (.+))$`, "i")
const RE_AU_TU = new RegExp(`^(À la?\\s+[^,]+,|Au\\s+[^,]+,|En\\s+[^,]+,|Chez\\s+[^,]+,)\\s+tu (?:${VERBS})\\b[^:]*?(?::\\s+(.+)| (.+))$`, "i")
const RE_POUR_TU = new RegExp(`^(Pour\\s+[^,]+,)\\s+tu (?:${VERBS})\\b[^:]*?(?::\\s+(.+)| (.+))$`, "i")

function capFirst(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s
}

const MIN_LEN = 25

function tryRewrite(cue: string): string | null {
  let m = cue.match(RE_COLON)
  if (m) {
    const out = capFirst(m[1].trim())
    if (out.length >= MIN_LEN) return out
  }
  m = cue.match(RE_QUE)
  if (m) {
    const out = capFirst(m[1].trim())
    if (out.length >= MIN_LEN) return out
  }
  for (const re of [RE_DANS_TU, RE_AU_TU, RE_POUR_TU]) {
    m = cue.match(re)
    if (m) {
      const head = m[1].trim()
      const tail = (m[2] ?? m[3] ?? "").trim()
      if (tail.length >= MIN_LEN - 5) {
        return `${head} ${tail}`
      }
    }
  }
  m = cue.match(RE_BARE)
  if (m) {
    const out = capFirst(m[1].trim())
    if (out.length >= 30) return out
  }
  return null
}

function main() {
  const argv = process.argv.slice(2)
  const file = argv[0]
  const apply = argv.includes("--apply")
  if (!file) {
    console.error("usage: tsx scripts/audit-batch.ts <seed.json> [--apply]")
    process.exit(1)
  }
  const seed = JSON.parse(fs.readFileSync(file, "utf8")) as Seed
  let count = 0
  const samples: Array<{ id: string; before: string; after: string }> = []
  const newQs = seed.questions.map((q) => {
    const next = tryRewrite(q.cue)
    if (next && next !== q.cue) {
      count++
      if (samples.length < 12) samples.push({ id: q.id, before: q.cue, after: next })
      return { ...q, cue: next }
    }
    return q
  })
  console.log(`File: ${file}`)
  console.log(`Cues rewritten: ${count} / ${seed.questions.length}`)
  for (const s of samples) {
    console.log(`\n[${s.id}]`)
    console.log(`  - ${s.before}`)
    console.log(`  + ${s.after}`)
  }
  if (apply && count > 0) {
    fs.writeFileSync(file, JSON.stringify({ ...seed, questions: newQs }, null, 2) + "\n", "utf8")
    console.log(`\nWritten ${file}.`)
  } else if (!apply) {
    console.log("\n(Dry run — re-run with --apply to write.)")
  }
}

main()
