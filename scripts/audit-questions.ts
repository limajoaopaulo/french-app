// Conservative audit pass over a seed.json:
// 1. Strip dominant common prefix from option arrays (kept in cue if missing).
// 2. Trim explanations that end in ": « answer »." or ": answer." restating
//    options[0].
// 3. Trim cues that begin with telegraphing meta-markers like
//    "Au passé composé,", "Au subjonctif,", "Politesse :", etc.
//
// Run: tsx scripts/audit-questions.ts <path-to-seed.json> [--apply]
// Without --apply, prints stats and a sample diff.

import fs from "node:fs"
import path from "node:path"

interface Question {
  id: string
  cue: string
  options: string[]
  correct_index: number
  explanation: string
  [key: string]: unknown
}

interface Seed {
  questions: Question[]
  [key: string]: unknown
}

const TELEGRAPH_PREFIXES = [
  /^au passé composé,?\s*/i,
  /^au subjonctif,?\s*/i,
  /^au futur(?: simple| proche| antérieur)?,?\s*/i,
  /^au présent,?\s*/i,
  /^au conditionnel(?: présent| passé)?,?\s*/i,
  /^à l['']imparfait,?\s*/i,
  /^au plus-que-parfait,?\s*/i,
  /^politesse\s*:\s*/i,
  /^formel\s*:\s*/i,
  /^familier\s*:\s*/i,
]

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function tightenExplanation(exp: string, answer: string): string {
  // Drop trailing ": « answer »." or ": answer." that just restates the answer.
  // Only if the answer text appears verbatim at the tail.
  const trimmed = exp.trim()
  const ans = answer.trim()
  if (ans.length < 2) return exp
  const ansEsc = escapeRegex(ans)
  // Pattern A: "rule : « answer »."
  const reA = new RegExp(`\\s*:\\s*«\\s*${ansEsc}\\s*»\\s*\\.?\\s*$`)
  if (reA.test(trimmed)) {
    return ensureSinglePeriod(trimmed.replace(reA, ""))
  }
  // Pattern B: "rule : answer." (only if answer is short — avoids cutting
  // legitimate continuations).
  if (ans.length <= 20) {
    const reB = new RegExp(`\\s*:\\s*${ansEsc}\\s*\\.?\\s*$`)
    if (reB.test(trimmed)) {
      return ensureSinglePeriod(trimmed.replace(reB, ""))
    }
  }
  return exp
}

function ensureSinglePeriod(s: string): string {
  const trimmed = s.replace(/[\s.]+$/, "")
  return trimmed + "."
}

function tightenCue(cue: string): string {
  let next = cue
  for (const re of TELEGRAPH_PREFIXES) {
    if (re.test(next)) {
      next = next.replace(re, "")
      // Capitalize first letter if it became lowercase.
      if (/^[a-zà-ÿ]/.test(next)) {
        next = next[0].toUpperCase() + next.slice(1)
      }
      break
    }
  }
  return next
}

function dominantCommonPrefix(strings: readonly string[]): string {
  if (strings.length < 2) return ""
  let i = 0
  const first = strings[0]
  while (i < first.length) {
    const ch = first[i]
    if (!strings.every((s) => s[i] === ch)) break
    i++
  }
  // Only treat as dominant if it covers > 60% of the shortest option AND
  // ends at a word boundary (don't cut mid-word).
  const minLen = Math.min(...strings.map((s) => s.length))
  if (i < minLen * 0.6) return ""
  // Walk back to last space to keep word boundary
  let cut = i
  while (cut > 0 && first[cut - 1] !== " ") cut--
  if (cut < 6) return ""
  return first.slice(0, cut)
}

interface AuditStats {
  total: number
  explanationTrimmed: number
  cueTrimmed: number
  optionsCommonPrefixDimmed: number
  samples: Array<{ id: string; field: string; before: string; after: string }>
}

function audit(seed: Seed): { seed: Seed; stats: AuditStats } {
  const stats: AuditStats = {
    total: seed.questions.length,
    explanationTrimmed: 0,
    cueTrimmed: 0,
    optionsCommonPrefixDimmed: 0,
    samples: [],
  }

  const newQs = seed.questions.map((q) => {
    const out = { ...q }
    const correctOption = q.options[q.correct_index] ?? ""

    const newExp = tightenExplanation(q.explanation, correctOption)
    if (newExp !== q.explanation) {
      stats.explanationTrimmed++
      if (stats.samples.length < 12) {
        stats.samples.push({
          id: q.id,
          field: "explanation",
          before: q.explanation,
          after: newExp,
        })
      }
      out.explanation = newExp
    }

    const newCue = tightenCue(q.cue)
    if (newCue !== q.cue) {
      stats.cueTrimmed++
      if (stats.samples.length < 12) {
        stats.samples.push({
          id: q.id,
          field: "cue",
          before: q.cue,
          after: newCue,
        })
      }
      out.cue = newCue
    }

    // Note: don't auto-rewrite options — too easy to break grammar. The diff
    // highlighter handles common-prefix dimming at render time. Just count
    // candidates for the report.
    const dom = dominantCommonPrefix(q.options)
    if (dom) {
      stats.optionsCommonPrefixDimmed++
    }

    return out
  })

  return { seed: { ...seed, questions: newQs }, stats }
}

function main() {
  const argv = process.argv.slice(2)
  const file = argv[0]
  const apply = argv.includes("--apply")
  if (!file) {
    console.error("usage: tsx scripts/audit-questions.ts <seed.json> [--apply]")
    process.exit(1)
  }
  const abs = path.resolve(file)
  const raw = fs.readFileSync(abs, "utf8")
  const seed = JSON.parse(raw) as Seed
  const { seed: out, stats } = audit(seed)

  console.log(`File: ${abs}`)
  console.log(`Total questions: ${stats.total}`)
  console.log(`Explanations trimmed: ${stats.explanationTrimmed}`)
  console.log(`Cues trimmed (telegraphing prefix removed): ${stats.cueTrimmed}`)
  console.log(
    `Options with dominant common prefix (UI diff handles): ${stats.optionsCommonPrefixDimmed}`,
  )
  console.log("")
  console.log("Sample changes:")
  for (const s of stats.samples) {
    console.log(`\n[${s.id}] ${s.field}`)
    console.log(`  - ${s.before}`)
    console.log(`  + ${s.after}`)
  }

  if (apply && (stats.explanationTrimmed > 0 || stats.cueTrimmed > 0)) {
    const formatted = JSON.stringify(out, null, 2) + "\n"
    fs.writeFileSync(abs, formatted, "utf8")
    console.log(`\nWritten ${abs}.`)
  } else if (!apply) {
    console.log("\n(Dry run — re-run with --apply to write.)")
  }
}

main()
