import { createReadStream, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { resolve } from "node:path"
import { createInterface } from "node:readline"

// Ingest a messy concatenated Anki export (see scripts/sentences/README.md §"Messy merges").
// Input rows come in several shapes:
//   A. Conjugation cards — F1 = "VERB[tense]", F2 = conjugation table. Skip.
//   B. EN→FR with "[open dict search]" + "Wiktionary search [fr]:" markers.
//   C. Either-direction with "French          show more" or "Wiktionary search.....:" markers.
//   D. Plain two-column FR/EN (no markers) — kept if both chunks classify cleanly.
// Noise strings we strip: "[open dict search]", "Wiktionary search:", "Wiktionary search [fr]:",
// "Wiktionary search.....:", "GT search.............:", "Full sentence.........:", "[gt]",
// "dl:", "rvs:", "show more", "French". We split on runs of 2+ spaces since Anki exports
// collapse inter-field gaps that way.

const OUT_DIR = resolve(process.cwd(), "scripts/sentences/data")
const OUT_FILE = resolve(OUT_DIR, "fr-merged.tsv")

const CONJUGATION_F1 = /^[A-ZÉÊÀÎÔÛÇÀÂÙÜÏŒ'\s-]+\[/
const SEPARATOR = /\s{2,}/

const NOISE_STRINGS = [
  "[open dict search]",
  "Wiktionary search:",
  "Wiktionary search [fr]:",
  "Wiktionary search.....:",
  "GT search.............:",
  "Full sentence.........:",
  "[gt]",
  "dl:",
  "rvs:",
  "show more",
  "French",
  "There are multiple ways to translate",
  "If you prefer another translation",
]

function stripNoise(chunk: string): string {
  let c = chunk.trim()
  for (const n of NOISE_STRINGS) {
    if (c === n) return ""
    if (c.startsWith(n)) c = c.slice(n.length).trim()
    if (c.endsWith(n)) c = c.slice(0, -n.length).trim()
  }
  return c.trim()
}

const FRENCH_ACCENTS = /[éèêëàâäùûüîïôöçÉÈÊËÀÂÄÙÛÜÎÏÔÖÇœŒ]/g
const FRENCH_STOPWORDS = new Set([
  "je", "j'", "tu", "il", "elle", "nous", "vous", "ils", "elles", "on",
  "le", "la", "les", "l'", "un", "une", "des", "du", "de", "d'",
  "qui", "que", "qu'", "dont", "où", "quoi",
  "ne", "n'", "pas", "plus", "jamais", "rien", "personne",
  "et", "ou", "mais", "donc", "car", "parce", "pour",
  "dans", "sur", "sous", "avec", "sans", "chez", "entre", "vers", "depuis",
  "est", "sont", "était", "sera", "suis", "es", "êtes", "sommes",
  "ai", "as", "avons", "avez", "ont", "avait", "avaient",
  "c'est", "n'est", "s'il", "s'est", "qu'il", "qu'elle", "qu'on",
  "très", "aussi", "alors", "même", "encore", "déjà", "jamais",
])
const ENGLISH_STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them",
  "my", "your", "his", "her", "its", "our", "their",
  "of", "in", "on", "at", "to", "for", "with", "from", "by", "about",
  "and", "or", "but", "so", "because",
  "do", "does", "did", "have", "has", "had", "will", "would", "could", "should",
  "what", "who", "when", "where", "why", "how", "which",
  "this", "that", "these", "those",
  "not", "n't", "no", "nothing", "nobody",
])

function tokenize(s: string): string[] {
  return s.toLowerCase().match(/[a-zà-ÿ']+/gi) ?? []
}

function scoreFrench(s: string): number {
  const accents = (s.match(FRENCH_ACCENTS) ?? []).length
  const tokens = tokenize(s)
  let fr = 0, en = 0
  for (const t of tokens) {
    if (FRENCH_STOPWORDS.has(t)) fr++
    if (ENGLISH_STOPWORDS.has(t)) en++
  }
  // Accent-bearing text is a strong FR signal; each accent = ~1.5 stopword weight.
  return accents * 1.5 + fr - en
}

const JUNK_PATTERNS = [
  /deepl/i,
  /google translate/i,
  /translations of/i,
  /edit the card/i,
  /if you prefer/i,
  /there are multiple/i,
  /a sentence, so the/i,
  /your liking/i,
  /card to your/i,
  /dl:\s/i,
  /rvs:\s/i,
  /^\[gt\]$/i,
  // IPA + dict-entry fragments mixed with translation: /foo/[adj] ...
  /^\/[^/]+\/\[[a-z]+\]/i,
  // Wiktionary / Treasury dictionary entries.
  /trésor de la langue/i,
  /treasury of the french/i,
  /digitized/i,
  /etymology/i,
  /further reading/i,
  /borrowed from (latin|greek|arabic|english|german|italian|spanish)/i,
  // Grammatical metadata: "[pl. ...]", "[adj]", "[n]" bracket markers alone.
  /\[pl\.\s/i,
  /^\[[a-z]+\]/i,
  // Pronunciation-trainer deck noise.
  /play buttons/i,
  /press(ing)? ['"]?5['"]?/i,
  /computer version of anki/i,
  /interrupt the audio/i,
  /audio samples/i,
  /back of the card/i,
  /french words:/i,
  // Grammar-note deck fragments.
  /usage notes/i,
  /(direct|indirect) object/i,
  /definite article/i,
  /(^|\s)de le is never/i,
  /(^|\s)à le is never/i,
  /previously mentioned or/i,
  /not translated in english/i,
  // Rows with an embedded "sentence ― translation" dash-separator.
  /[\s][—―][\s]/,
  // Wiktionary / grammar-note deck noise.
  /wiktionary/i,
  /homophones?:/i,
  /\brhymes?:/i,
  /\(feminine [a-zà-ÿ]+,/i,
  /\bplural\s+(des|les)\b/i,
  /\(second person/i,
  /\(first person/i,
  /\(third person/i,
  /^article [a-z]+\s+[mf]\b/i,
  /^pronoun\s+[a-z]+\s+\(/i,
  /also used when a group/i,
  /\bsubject to liaison/i,
  /\bchapter [IVX]+\b/,
  /\btranslation of [A-Z]/,
]

function isPlausibleSentence(s: string): boolean {
  if (s.length < 6 || s.length > 200) return false
  // Must have at least one letter.
  if (!/[a-zà-ÿ]/i.test(s)) return false
  // Require ≥3 word tokens — drops single-word dict entries.
  const tokens = s.match(/[a-zà-ÿ]+(?:['-][a-zà-ÿ]+)*/gi) ?? []
  if (tokens.length < 3) return false
  // Reject syllable-drill rows like "sa, cêve, seur, sé" — no token is ≥5 chars.
  if (!tokens.some((t) => t.length >= 5)) return false
  // Reject comma-list syllable drills: many commas + low avg token length.
  const commaCount = (s.match(/,/g) ?? []).length
  if (commaCount >= 3) {
    const avgLen = tokens.reduce((sum, t) => sum + t.length, 0) / tokens.length
    if (avgLen <= 4) return false
  }
  // Reject things that look like tag/markup residue.
  if (/^[A-Z_]+$/.test(s)) return false
  if (s.startsWith("#")) return false
  // Reject conjugation fragments (run-together forms like "jetuil, elle...").
  if (/^(je|tu|il|elle|nous|vous|ils|elles)(je|tu|il|elle|nous|vous|ils|elles)/.test(s)) return false
  // Reject strings dominated by IPA-like slashes.
  if ((s.match(/\//g) ?? []).length > 3) return false
  // Reject deck-disclaimer / metadata fragments.
  for (const p of JUNK_PATTERNS) if (p.test(s)) return false
  return true
}

function extractChunks(f1: string, f2: string): string[] {
  const raw = [f1, ...f2.split(SEPARATOR)].map(stripNoise).filter(Boolean)
  const out: string[] = []
  const seen = new Set<string>()
  for (const chunk of raw) {
    if (!isPlausibleSentence(chunk)) continue
    // Canonical key for dedup — case + spaces folded.
    const key = chunk.toLowerCase().replace(/\s+/g, " ").trim()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(chunk)
  }
  return out
}

function pickPair(chunks: string[]): { fr: string; en: string } | null {
  if (chunks.length < 2) return null
  // Score every chunk; keep the max-FR and max-EN (=min-FR) scorers.
  const scored = chunks.map((c) => ({ chunk: c, score: scoreFrench(c) }))
  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]
  const worst = scored[scored.length - 1]
  // Need a clear separation — FR winner must have positive score, EN winner must be non-positive.
  if (best.score <= 0) return null
  if (worst.score >= best.score) return null
  return { fr: best.chunk, en: worst.chunk }
}

type Stats = {
  total: number
  emitted: number
  skipConjugation: number
  skipHeader: number
  skipEmpty: number
  skipUnclassified: number
  skipNoPair: number
}

async function main() {
  const inputPath = process.argv[2]
  if (!inputPath) {
    console.error("Usage: tsx scripts/sentences/ingest.ts <path-to-source-txt>")
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
    skipConjugation: 0, skipHeader: 0, skipEmpty: 0,
    skipUnclassified: 0, skipNoPair: 0,
  }

  const rows: Array<{ fr: string; en: string; source: string }> = []

  for await (const line of rl) {
    stats.total++
    if (!line || line.startsWith("#")) { stats.skipHeader++; continue }

    const tabs = line.split("\t")
    const f1 = (tabs[0] ?? "").trim()
    const f2 = (tabs[1] ?? "").trim()

    if (!f1 && !f2) { stats.skipEmpty++; continue }
    if (CONJUGATION_F1.test(f1)) { stats.skipConjugation++; continue }

    const chunks = extractChunks(f1, f2)
    if (chunks.length < 2) { stats.skipNoPair++; continue }

    const pair = pickPair(chunks)
    if (!pair) { stats.skipUnclassified++; continue }

    rows.push({ fr: pair.fr, en: pair.en, source: "fr-merged" })
    stats.emitted++
  }

  // Dedup on FR text (normalized) — different deck copies of the same sentence.
  const byFr = new Map<string, { fr: string; en: string; source: string }>()
  for (const r of rows) {
    const key = r.fr.toLowerCase().replace(/\s+/g, " ").trim()
    if (!byFr.has(key)) byFr.set(key, r)
  }
  const unique = [...byFr.values()]

  // Emit TSV: fr\ten\trank\tsource, rank = line number.
  const out: string[] = []
  unique.forEach((r, i) => {
    out.push(`${r.fr}\t${r.en}\t${i + 1}\t${r.source}`)
  })
  writeFileSync(OUT_FILE, out.join("\n") + "\n", "utf8")

  console.log(`Ingest complete: ${OUT_FILE}`)
  console.log(`  input rows      : ${stats.total}`)
  console.log(`  header/comment  : ${stats.skipHeader}`)
  console.log(`  empty           : ${stats.skipEmpty}`)
  console.log(`  conjugation     : ${stats.skipConjugation}`)
  console.log(`  no pair         : ${stats.skipNoPair}`)
  console.log(`  unclassified    : ${stats.skipUnclassified}`)
  console.log(`  emitted (raw)   : ${stats.emitted}`)
  console.log(`  unique FR pairs : ${unique.length}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
