// Strip dominant common PREFIX from options when it's a "context phrase"
// (≥3 words, ≥18 chars, ends at word boundary, NOT starting with "Je"/"J'"
// since those are subject pronouns whose presence might be the test).
import fs from "node:fs"

interface Question {
  id: string
  cue: string
  cue_type: string
  options: string[]
  correct_index: number
}
interface Seed { questions: Question[] }

function commonPrefix(opts: readonly string[]): string {
  if (opts.length < 2) return ""
  let i = 0
  const first = opts[0]
  while (i < first.length) {
    const ch = first[i]
    if (!opts.every((s) => s[i] === ch)) break
    i++
  }
  let cut = i
  while (cut > 0 && first[cut - 1] !== " ") cut--
  return first.slice(0, cut)
}

function main() {
  const argv = process.argv.slice(2)
  const file = argv[0]
  const apply = argv.includes("--apply")
  if (!file) { console.error("usage"); process.exit(1) }
  const seed = JSON.parse(fs.readFileSync(file, "utf8")) as Seed
  let count = 0
  const samples: Array<{ id: string; cue: string; before: string[]; after: string[] }> = []
  const newQs = seed.questions.map((q) => {
    if (q.options.length !== 4) return q
    const p = commonPrefix(q.options)
    if (p.length < 10) return q
    if (p.split(/\s+/).filter(Boolean).length < 2) return q
    // Skip if prefix starts with subject pronouns (testing conjugation)
    if (/^(j[e']|tu |il |elle |on |nous |vous |ils |elles )/i.test(p)) return q
    const stripped = q.options.map((o) => o.slice(p.length))
    if (stripped.some((s) => s.length < 3)) return q
    if (new Set(stripped).size !== 4) return q
    count++
    if (samples.length < 5) {
      samples.push({ id: q.id, cue: q.cue, before: q.options, after: stripped })
    }
    return { ...q, options: stripped }
  })
  console.log(`File: ${file}`)
  console.log(`Options prefix-stripped: ${count} / ${seed.questions.length}`)
  for (const s of samples) {
    console.log(`\n[${s.id}]`)
    console.log(`  cue: ${s.cue}`)
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
