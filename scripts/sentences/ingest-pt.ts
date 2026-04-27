import { createReadStream, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { resolve } from "node:path"
import { createInterface } from "node:readline"

// Ingest the user's merged Brazilian Portuguese Anki export.
//
// The PT decks are cleaner than the FR dump — each deck has a consistent 10-column
// shape, so we dispatch on the first column ("deck name") instead of pattern-matching.
//
// Deck shapes:
//   A. "WikiRoots"                       — col 1 = "WikiRoots", col 10 = concatenated
//      PT/EN example pairs. Within the field, each pair is "PT_sentence.   EN_sentence."
//      (three-space separator), and pairs run together with NO delimiter: the end of
//      one pair ("tomorrow.") is immediately followed by the next PT sentence ("Você...").
//      Strategy: split on `[.!?]\s*(?=[A-ZÀ-Ü])` to find pair boundaries (a terminator
//      followed directly by a capital), then split each pair on `\s{2,}` into PT / EN.
//   B. "Ultimate Portuguese Conjugation" — col 2 = sentence with a {{c1::form::lemma}}
//      cloze marker, col 4 = tense label ("Presente do Indicativo", "Futuro do
//      Subjuntivo", etc.), col 5 = EN translation, col 7 = subject scope. These are
//      ready-made conjugation drill fuel.
//   C. "0 Neri's Sentences (Read)" / "(Speak)" — col 2 = PT, col 3 = EN. Short A1 phrases.
//   D. "Intro card" / other — skip.
//
// Output: scripts/sentences/data/pt-merged.tsv with columns
//   pt \t en \t rank \t source \t tense \t subject
// tense and subject are empty except for rows from Ultimate Portuguese Conjugation.

const OUT_DIR = resolve(process.cwd(), "scripts/sentences/data")
const OUT_FILE = resolve(OUT_DIR, "pt-merged.tsv")

const PT_ACCENTS = /[áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ]/g
const PT_STOPWORDS = new Set([
  "o", "a", "os", "as", "um", "uma", "uns", "umas",
  "de", "do", "da", "dos", "das", "no", "na", "nos", "nas",
  "em", "com", "para", "por", "pelo", "pela", "pelos", "pelas",
  "que", "qual", "quais", "quem", "onde", "quando", "como", "porque",
  "e", "ou", "mas", "também",
  "eu", "tu", "você", "ele", "ela", "nós", "vocês", "eles", "elas",
  "me", "te", "se", "lhe", "nos", "lhes",
  "meu", "minha", "seu", "sua", "teu", "tua", "nosso", "nossa",
  "é", "são", "era", "eram", "foi", "foram", "será", "seria",
  "estou", "está", "estão", "estava", "estavam", "esteve", "estiveram",
  "tenho", "tem", "temos", "têm", "tinha", "tiveram",
  "vou", "vai", "vamos", "vão", "ia", "iam",
  "não", "nunca", "nada", "ninguém", "nenhum", "nenhuma",
  "já", "ainda", "muito", "mais", "menos", "bem", "mal",
  "isso", "isto", "aquilo", "este", "esta", "esse", "essa", "aquele", "aquela",
])
const EN_STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them",
  "my", "your", "his", "her", "its", "our", "their",
  "of", "in", "on", "at", "to", "for", "with", "from", "by", "about",
  "and", "or", "but", "so", "because",
  "do", "does", "did", "have", "has", "had", "will", "would", "could", "should",
  "what", "who", "when", "where", "why", "how", "which",
  "this", "that", "these", "those",
  "not", "no", "nothing", "nobody",
])

function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[a-zà-ÿ']+/gi) ?? [])
}

function scorePortuguese(s: string): number {
  const accents = (s.match(PT_ACCENTS) ?? []).length
  const tokens = tokenize(s)
  let pt = 0, en = 0
  for (const t of tokens) {
    if (PT_STOPWORDS.has(t)) pt++
    if (EN_STOPWORDS.has(t)) en++
  }
  return accents * 1.5 + pt - en
}

function cleanSentence(s: string): string {
  return s.replace(/\s+/g, " ").trim()
}

function isPlausibleSentence(s: string): boolean {
  const trimmed = s.trim()
  if (trimmed.length < 5 || trimmed.length > 220) return false
  if (!/[a-zà-ÿ]/i.test(trimmed)) return false
  const tokens = trimmed.match(/[a-zà-ÿ]+(?:['-][a-zà-ÿ]+)*/gi) ?? []
  if (tokens.length < 2) return false
  return true
}

// WikiRoots examples: split concatenated pair list into individual pairs.
// Boundary heuristic: a sentence-terminator (. ! ?) directly followed (no whitespace)
// by an uppercase letter. If there's whitespace after the terminator, we're still
// inside the same pair (intra-pair "   " gap between PT and EN).
function splitWikirootsPairs(examples: string): string[] {
  if (!examples) return []
  // Split only when period/bang/question is followed *immediately* by an uppercase letter.
  // The negative-lookbehind on "Sr./Sra." edge cases is not worth the complexity — WikiRoots
  // sentences don't abbreviate mid-example.
  const parts: string[] = []
  let start = 0
  for (let i = 0; i < examples.length - 1; i++) {
    const ch = examples[i]
    const next = examples[i + 1]
    if ((ch === "." || ch === "!" || ch === "?") && /[A-ZÀ-Ü]/.test(next)) {
      parts.push(examples.slice(start, i + 1))
      start = i + 1
    }
  }
  parts.push(examples.slice(start))
  return parts.map((p) => p.trim()).filter(Boolean)
}

function extractWikirootsPair(pairStr: string): { pt: string; en: string } | null {
  // Each pair looks like "Vão nomear um novo diretor amanhã.   They will appoint a new director tomorrow."
  // Split on runs of 2+ spaces.
  const chunks = pairStr.split(/\s{2,}/).map(cleanSentence).filter(Boolean)
  if (chunks.length < 2) return null
  // Score each; best-PT and best-EN (=lowest-PT score) win.
  const scored = chunks.map((c) => ({ c, s: scorePortuguese(c) }))
  scored.sort((a, b) => b.s - a.s)
  const best = scored[0]
  const worst = scored[scored.length - 1]
  if (!isPlausibleSentence(best.c) || !isPlausibleSentence(worst.c)) return null
  if (best.s <= 0 || worst.s >= best.s) return null
  return { pt: best.c, en: worst.c }
}

// Ultimate Portuguese Conjugation cloze: {{c1::form::hint}} — the first slot is the
// answer form; the second (if present) is the infinitive/hint and is thrown away here.
// We keep the form in-place (not replaced) so the PT sentence is readable as-is; the
// downstream authoring pass can re-extract the cloze if needed.
function stripCloze(s: string): string {
  return s.replace(/\{\{c\d+::([^:}]+)(?:::[^}]*)?\}\}/g, "$1").trim()
}

function extractClozeForm(s: string): string | null {
  const m = s.match(/\{\{c\d+::([^:}]+)(?:::([^}]*))?\}\}/)
  return m ? m[1].trim() : null
}

type Row = {
  pt: string
  en: string
  source: string
  tense: string
  subject: string
}

type Stats = {
  total: number
  emitted: number
  skipHeader: number
  skipEmpty: number
  skipUnknownDeck: number
  skipWikiroots: number
  skipConjugation: number
  skipNeri: number
  emittedWikiroots: number
  emittedConjugation: number
  emittedNeri: number
}

async function main() {
  const inputPath = process.argv[2]
  if (!inputPath) {
    console.error("Usage: tsx scripts/sentences/ingest-pt.ts <path-to-pt-br-txt>")
    process.exit(2)
  }
  if (!existsSync(inputPath)) {
    console.error(`Source file not found: ${inputPath}`)
    process.exit(2)
  }
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

  const stream = createReadStream(inputPath, { encoding: "utf8" })
  const rl = createInterface({ input: stream, crlfDelay: Infinity })

  const stats: Stats = {
    total: 0, emitted: 0,
    skipHeader: 0, skipEmpty: 0, skipUnknownDeck: 0,
    skipWikiroots: 0, skipConjugation: 0, skipNeri: 0,
    emittedWikiroots: 0, emittedConjugation: 0, emittedNeri: 0,
  }

  const rows: Row[] = []

  for await (const line of rl) {
    stats.total++
    if (!line || line.startsWith("#")) { stats.skipHeader++; continue }

    const cols = line.split("\t")
    const deck = (cols[0] ?? "").trim()
    if (!deck) { stats.skipEmpty++; continue }

    if (deck === "WikiRoots") {
      const examples = (cols[9] ?? "").trim()
      if (!examples) { stats.skipWikiroots++; continue }
      const pairs = splitWikirootsPairs(examples)
      let emittedThisRow = 0
      for (const p of pairs) {
        const pair = extractWikirootsPair(p)
        if (!pair) continue
        rows.push({ pt: pair.pt, en: pair.en, source: "wikiroots", tense: "", subject: "" })
        emittedThisRow++
      }
      if (emittedThisRow === 0) stats.skipWikiroots++
      else stats.emittedWikiroots += emittedThisRow
      continue
    }

    if (deck === "Ultimate Portuguese Conjugation") {
      const clozeSentence = (cols[1] ?? "").trim()
      const tense = (cols[3] ?? "").trim()
      const en = cleanSentence(cols[4] ?? "")
      const subject = (cols[6] ?? "").trim()
      if (!clozeSentence || !en) { stats.skipConjugation++; continue }
      const pt = cleanSentence(stripCloze(clozeSentence))
      const form = extractClozeForm(clozeSentence) ?? ""
      if (!isPlausibleSentence(pt) || !isPlausibleSentence(en)) {
        stats.skipConjugation++
        continue
      }
      rows.push({
        pt,
        en,
        source: "conjugation",
        tense,
        // Encode subject + target form so downstream authoring can rebuild a cloze question.
        subject: form ? `${subject}|form=${form}` : subject,
      })
      stats.emittedConjugation++
      continue
    }

    if (deck === "0 Neri's Sentences (Read)" || deck === "0 Neri's Sentences (Speak)") {
      const pt = cleanSentence(cols[1] ?? "")
      const en = cleanSentence(cols[2] ?? "")
      if (!pt || !en) { stats.skipNeri++; continue }
      if (!isPlausibleSentence(pt) || !isPlausibleSentence(en)) { stats.skipNeri++; continue }
      rows.push({ pt, en, source: "neri", tense: "", subject: "" })
      stats.emittedNeri++
      continue
    }

    stats.skipUnknownDeck++
  }

  // Dedup on normalized PT.
  const byKey = new Map<string, Row>()
  for (const r of rows) {
    const key = r.pt.toLowerCase().replace(/\s+/g, " ").trim()
    if (!byKey.has(key)) byKey.set(key, r)
  }
  const unique = [...byKey.values()]
  stats.emitted = unique.length

  const out: string[] = []
  unique.forEach((r, i) => {
    out.push([r.pt, r.en, i + 1, r.source, r.tense, r.subject].join("\t"))
  })
  writeFileSync(OUT_FILE, out.join("\n") + "\n", "utf8")

  console.log(`Ingest complete: ${OUT_FILE}`)
  console.log(`  input rows           : ${stats.total}`)
  console.log(`  header/comment       : ${stats.skipHeader}`)
  console.log(`  empty deck           : ${stats.skipEmpty}`)
  console.log(`  unknown deck         : ${stats.skipUnknownDeck}`)
  console.log(`  wikiroots emitted    : ${stats.emittedWikiroots}`)
  console.log(`  wikiroots skipped    : ${stats.skipWikiroots}`)
  console.log(`  conjugation emitted  : ${stats.emittedConjugation}`)
  console.log(`  conjugation skipped  : ${stats.skipConjugation}`)
  console.log(`  neri emitted         : ${stats.emittedNeri}`)
  console.log(`  neri skipped         : ${stats.skipNeri}`)
  console.log(`  unique PT pairs      : ${unique.length}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
