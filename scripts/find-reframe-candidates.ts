// Find questions that should be reframed as gap_fr: 4 long options that
// are nearly identical except for a tiny grammatical token (preposition,
// article, conjunction). These are de-facto fill-in-the-blank exercises
// dressed up as full sentences.
import fs from "node:fs"

interface Question {
  id: string
  cue: string
  cue_type: string
  options: string[]
  correct_index: number
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

function main() {
  const file = process.argv[2]
  const seed = JSON.parse(fs.readFileSync(file, "utf8")) as Seed
  let count = 0
  for (const q of seed.questions) {
    if (q.cue_type === "gap_fr") continue
    if (q.options.length !== 4) continue
    const minLen = Math.min(...q.options.map((o) => o.length))
    if (minLen < 20) continue // must be full-sentence options
    // Compute pairwise common prefix/suffix vs option 0
    const o0 = q.options[0]
    let totalShared = 0
    let totalDiff = 0
    for (let i = 1; i < 4; i++) {
      const oi = q.options[i]
      const p = lcp(o0, oi)
      const s = lcs(o0.slice(p), oi.slice(p))
      totalShared += p + s
      totalDiff += Math.max(o0.length, oi.length) - p - s
    }
    // High share, small diff → reframable
    const avgShared = totalShared / 3
    const avgDiff = totalDiff / 3
    if (avgShared >= o0.length * 0.7 && avgDiff <= 8) {
      count++
      if (count <= 8) {
        console.log(`[${q.id}] cue_type=${q.cue_type}`)
        console.log(`  cue: ${q.cue}`)
        for (const o of q.options) console.log(`  - ${o}`)
        console.log("")
      }
    }
  }
  console.log(`Total reframe candidates: ${count}`)
}
main()
