// Strips common trailing chunk from options when 4 options share ≥10 chars
// at the end — that suffix is narrative repetition, not the test.
// Keeps test surface (variation) intact at the option starts.
import fs from "node:fs"

interface Question {
  id: string
  cue: string
  cue_type: string
  options: string[]
  correct_index: number
}
interface Seed { questions: Question[] }

function commonSuffix(opts: readonly string[]): string {
  if (opts.length < 2) return ""
  let i = 0
  const first = opts[0]
  while (i < first.length) {
    const ch = first[first.length - 1 - i]
    if (!opts.every((s) => s[s.length - 1 - i] === ch)) break
    i++
  }
  return first.slice(first.length - i)
}

function main() {
  const argv = process.argv.slice(2)
  const file = argv[0]
  const apply = argv.includes("--apply")
  if (!file) { console.error("usage"); process.exit(1) }
  const seed = JSON.parse(fs.readFileSync(file, "utf8")) as Seed
  let count = 0
  const samples: Array<{ id: string; before: string[]; after: string[]; cue: string }> = []
  const newQs = seed.questions.map((q) => {
    if (q.options.length !== 4) return q
    const suf = commonSuffix(q.options)
    // Walk back to last word boundary (space) for clean cuts.
    let cut = suf.length
    while (cut > 0 && suf[suf.length - cut] !== " " && suf[0] !== " ") {
      // suf must start with space, otherwise we're cutting mid-word
      break
    }
    if (suf.length < 10 || suf[0] !== " ") return q
    const stripped = q.options.map((o) => o.slice(0, o.length - suf.length))
    // Reject if any option becomes too short
    if (stripped.some((s) => s.length < 3)) return q
    // Reject if duplicates
    if (new Set(stripped).size !== 4) return q
    count++
    if (samples.length < 5) {
      samples.push({ id: q.id, before: q.options, after: stripped, cue: q.cue })
    }
    return { ...q, options: stripped }
  })
  console.log(`File: ${file}`)
  console.log(`Options suffix-stripped: ${count} / ${seed.questions.length}`)
  for (const s of samples) {
    console.log(`\n[${s.id}]`)
    console.log(`  cue: ${s.cue}`)
    console.log(`  before:`)
    for (const o of s.before) console.log(`    - ${o}`)
    console.log(`  after:`)
    for (const o of s.after) console.log(`    - ${o}`)
  }
  if (apply && count > 0) {
    fs.writeFileSync(file, JSON.stringify({ ...seed, questions: newQs }, null, 2) + "\n", "utf8")
    console.log(`\nWritten ${file}.`)
  } else if (!apply) {
    console.log("\n(Dry run — re-run with --apply to write.)")
  }
}
main()
