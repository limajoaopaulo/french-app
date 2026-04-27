// Reframe full-sentence questions where 4 options differ only by a tiny
// internal token (preposition, article, conjunction) into gap_fr form.
// Replaces cue with the gap-form sentence and options with bare tokens.
import fs from "node:fs"

interface Question {
  id: string
  cue: string
  cue_type: string
  options: string[]
  correct_index: number
  [key: string]: unknown
}
interface Seed { questions: Question[] }

function lcp(a: string, b: string): number {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}
function lcs(a: string, b: string): number {
  let i = 0
  while (i < a.length && i < b.length && a[a.length-1-i] === b[b.length-1-i]) i++
  return i
}

function commonPrefix(opts: readonly string[]): number {
  let p = opts[0].length
  for (let i = 1; i < opts.length; i++) p = Math.min(p, lcp(opts[0], opts[i]))
  // Walk back to last space (don't cut mid-word)
  while (p > 0 && opts[0][p - 1] !== " " && opts[0][p] !== " ") p--
  return p
}
function commonSuffix(opts: readonly string[], from: number): number {
  let s = opts[0].length - from
  const tail0 = opts[0].slice(from)
  for (let i = 1; i < opts.length; i++) {
    s = Math.min(s, lcs(tail0, opts[i].slice(from)))
  }
  // Walk forward so the suffix STARTS at a space (don't cut mid-word)
  const o = opts[0]
  while (s > 0 && o[o.length - s] !== " " && o[o.length - s - 1] !== " ") s--
  return s
}

function main() {
  const argv = process.argv.slice(2)
  const file = argv[0]
  const apply = argv.includes("--apply")
  if (!file) { console.error("usage"); process.exit(1) }
  const seed = JSON.parse(fs.readFileSync(file, "utf8")) as Seed
  let count = 0
  const samples: Array<{ id: string; cueOld: string; cueNew: string; before: string[]; after: string[] }> = []
  const newQs = seed.questions.map((q) => {
    if (q.options.length !== 4) return q
    if (q.cue_type === "gap_fr") return q // already gap form
    if (q.cue_type === "intent_en") return q // English intent carries info
    const o0 = q.options[0]
    const p = commonPrefix(q.options)
    const s = commonSuffix(q.options, p)
    // Require BOTH sides of the gap to have content (≥4 chars each)
    if (p < 4 || s < 4) return q
    const middles = q.options.map((o) => o.slice(p, o.length - s))
    // Each middle must be ≤6 chars and non-empty
    if (middles.some((m) => m.length > 6 || m.length === 0)) return q
    // All 4 middles must be unique
    if (new Set(middles).size !== 4) return q
    // Combined prefix+suffix must be substantial (≥75% of option)
    if ((p + s) < o0.length * 0.75) return q
    // Build gap cue
    const cueGap = `${o0.slice(0, p)}___${o0.slice(o0.length - s)}`
    count++
    if (samples.length < 6) {
      samples.push({ id: q.id, cueOld: q.cue, cueNew: cueGap, before: q.options, after: middles })
    }
    return { ...q, cue_type: "gap_fr", cue: cueGap, options: middles }
  })
  console.log(`File: ${file}`)
  console.log(`Reframed to gap_fr: ${count} / ${seed.questions.length}`)
  for (const s of samples) {
    console.log(`\n[${s.id}]`)
    console.log(`  cue old: ${s.cueOld}`)
    console.log(`  cue new: ${s.cueNew}`)
    console.log(`  before:`); for (const o of s.before) console.log(`    - ${o}`)
    console.log(`  after:`); for (const o of s.after) console.log(`    - ${o}`)
  }
  if (apply && count > 0) {
    fs.writeFileSync(file, JSON.stringify({ ...seed, questions: newQs }, null, 2) + "\n", "utf8")
    console.log(`\nWritten ${file}.`)
  } else if (!apply) {
    console.log("\n(Dry run.)")
  }
}
main()
