// Identifies questions that match our agreed rewrite patterns.
// Outputs candidate IDs grouped by pattern type, no rewrites — they're
// judgment calls. Use this to pick the next batch for review.

import fs from "node:fs"

interface Question {
  id: string
  cue: string
  options: string[]
  correct_index: number
  explanation: string
  cue_type: string
}

interface Seed {
  questions: Question[]
}

function commonPrefixWord(strings: readonly string[]): string {
  if (strings.length < 2) return ""
  let i = 0
  const first = strings[0]
  while (i < first.length) {
    const ch = first[i]
    if (!strings.every((s) => s[i] === ch)) break
    i++
  }
  let cut = i
  while (cut > 0 && first[cut - 1] !== " ") cut--
  return first.slice(0, cut)
}

function dominantPrefix(opts: readonly string[]): string | null {
  const p = commonPrefixWord(opts)
  if (p.length < 6) return null
  const minLen = Math.min(...opts.map((o) => o.length))
  if (p.length < minLen * 0.4) return null
  return p
}

function looksTelegraphing(cueType: string, cue: string, correct: string): boolean {
  // English cues can't telegraph (answer is in French).
  if (cueType === "intent_en") return false
  // Heuristic: a word ≥6 chars present in BOTH cue and correct option, ignoring
  // common stop-words. Length-6 filter excludes most short nouns ("froid")
  // while still catching conjugated verb forms ("réussisse", "habitais").
  const stop = new Set([
    "demain","aujourd","hier","matin","cette","cetait","cest",
    "personne","quelque","quelques","plusieurs","beaucoup","toujours","jamais",
    "exemple","exemples",
  ])
  const words = (s: string) => s.toLowerCase()
    .replace(/[«»"',.;:!?()\-–—]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 6 && !stop.has(w))

  const cueWords = new Set(words(cue))
  const ansWords = words(correct)
  return ansWords.some((w) => cueWords.has(w))
}

function looksMultiRule(exp: string): boolean {
  // Heuristic: explanation has a semicolon, or " ; ", or two sentences with
  // " = " patterns suggesting distractor labelling.
  if (exp.length < 40) return false
  if (/\s;\s/.test(exp)) return true
  const eq = (exp.match(/=/g) ?? []).length
  if (eq >= 2) return true
  return false
}

function isStageSetterCue(cue: string): boolean {
  // 12+ words AND starts with one of the long stage setters.
  const wc = cue.split(/\s+/).length
  if (wc < 10) return false
  return /^(Tu expliques|Tu décris|Tu commentes|Tu racontes|Tu indiques|Tu signales|Tu informes|Dans (un|une) [a-zé]+, tu )/i.test(cue)
}

function main() {
  const file = process.argv[2]
  if (!file) {
    console.error("usage: tsx scripts/audit-candidates.ts <seed.json>")
    process.exit(1)
  }
  const seed = JSON.parse(fs.readFileSync(file, "utf8")) as Seed
  const candidates = {
    p1_dominant_prefix: [] as Array<{ id: string; prefix: string; len: number }>,
    p2_stage_setter_cue: [] as Array<{ id: string; cue: string }>,
    p3_telegraphing: [] as Array<{ id: string; cue: string; correct: string }>,
    p5_multi_rule_exp: [] as Array<{ id: string; exp: string }>,
  }
  for (const q of seed.questions) {
    const correct = q.options[q.correct_index] ?? ""
    const dom = dominantPrefix(q.options)
    if (dom) candidates.p1_dominant_prefix.push({ id: q.id, prefix: dom, len: dom.length })
    if (isStageSetterCue(q.cue)) candidates.p2_stage_setter_cue.push({ id: q.id, cue: q.cue })
    if (looksTelegraphing(q.cue_type, q.cue, correct)) candidates.p3_telegraphing.push({ id: q.id, cue: q.cue, correct })
    if (looksMultiRule(q.explanation)) candidates.p5_multi_rule_exp.push({ id: q.id, exp: q.explanation })
  }
  console.log(`File: ${file}`)
  console.log(`Total: ${seed.questions.length}`)
  console.log(`p1 dominant common prefix: ${candidates.p1_dominant_prefix.length}`)
  console.log(`p2 stage-setter cue: ${candidates.p2_stage_setter_cue.length}`)
  console.log(`p3 telegraphing answer: ${candidates.p3_telegraphing.length}`)
  console.log(`p5 multi-rule explanation: ${candidates.p5_multi_rule_exp.length}`)
  console.log("")
  console.log("=== p1 sample ===")
  for (const c of candidates.p1_dominant_prefix.slice(5, 10)) {
    console.log(`  ${c.id}: prefix="${c.prefix}" (${c.len} chars)`)
  }
  console.log("=== p2 sample ===")
  for (const c of candidates.p2_stage_setter_cue.slice(5, 10)) {
    console.log(`  ${c.id}: ${c.cue}`)
  }
  console.log("=== p3 ALL ===")
  for (const c of candidates.p3_telegraphing) {
    console.log(`  ${c.id}|${c.cue}|${c.correct}`)
  }
}

main()
