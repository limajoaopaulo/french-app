import { readFileSync, existsSync, readdirSync } from "node:fs"
import { resolve, join } from "node:path"
import { GRAMMAR_PATTERNS, VOCAB_PATTERNS, type PatternEntry } from "./patterns"

const DATA_DIR = resolve(process.cwd(), "scripts/sentences/data")
const MERGED_FILE = "merged.tsv"

type Sentence = { fr: string; en: string; rank: number; source: string }

type Mode =
  | { kind: "raw"; query: string; regex: boolean }
  | { kind: "pattern"; key: string; entry: PatternEntry }
  | { kind: "sub"; key: string; entry: PatternEntry }

type Args = {
  mode: Mode
  minRank: number
  maxRank: number
  limit: number
  source: string | null
  json: boolean
}

function printHelpAndExit(code: number): never {
  const msg = `
Usage:
  tsx scripts/sentences/search.ts <query> [flags]
  tsx scripts/sentences/search.ts --pattern <grammar-pattern-key> [flags]
  tsx scripts/sentences/search.ts --sub <vocab-sub-pattern-key> [flags]

Modes:
  <query>              Literal substring (word-boundary, case/diacritic-insensitive)
  --regex              Treat <query> as a regex instead
  --pattern <key>      Grammar pattern library (e.g. relatif-dont, pc-avoir, si-type2)
  --sub <key>          Vocab keyword library (e.g. admin_bureaucracy/banque-compte)

Common flags:
  --min-rank N         Lower bound on rank (default 0)
  --max-rank N         Upper bound on rank (default unlimited)
  --limit N            Max results (default 20)
  --source <stem>      Only read data/<stem>.tsv (e.g. fr-5000, fr-16000)
  --json               Emit JSON instead of table
  --help               This help
`.trim()
  console.log(msg)
  process.exit(code)
}

function parseArgs(argv: string[]): Args {
  const args = [...argv]
  const getFlag = (name: string, hasValue: boolean): string | true | null => {
    const i = args.indexOf(name)
    if (i === -1) return null
    if (!hasValue) {
      args.splice(i, 1)
      return true
    }
    const v = args[i + 1]
    if (v === undefined) {
      console.error(`Missing value for ${name}`)
      process.exit(2)
    }
    args.splice(i, 2)
    return v
  }

  if (getFlag("--help", false)) printHelpAndExit(0)

  const rawRegex = getFlag("--regex", false) === true
  const patternKey = getFlag("--pattern", true) as string | null
  const subKey = getFlag("--sub", true) as string | null
  const minRankS = getFlag("--min-rank", true) as string | null
  const maxRankS = getFlag("--max-rank", true) as string | null
  const limitS = getFlag("--limit", true) as string | null
  const source = getFlag("--source", true) as string | null
  const json = getFlag("--json", false) === true

  const positional = args.filter((a) => !a.startsWith("--"))
  const modeCount = [patternKey, subKey, positional[0]].filter(Boolean).length
  if (modeCount === 0) {
    console.error("Error: must provide <query>, --pattern <key>, or --sub <key>.\n")
    printHelpAndExit(2)
  }
  if (modeCount > 1) {
    console.error("Error: choose exactly one of <query>, --pattern, --sub.\n")
    printHelpAndExit(2)
  }

  let mode: Mode
  if (patternKey) {
    const entry = GRAMMAR_PATTERNS[patternKey]
    if (!entry) {
      suggestAndExit(patternKey, Object.keys(GRAMMAR_PATTERNS), "--pattern")
    }
    mode = { kind: "pattern", key: patternKey, entry }
  } else if (subKey) {
    const entry = VOCAB_PATTERNS[subKey]
    if (!entry) {
      suggestAndExit(subKey, Object.keys(VOCAB_PATTERNS), "--sub")
    }
    mode = { kind: "sub", key: subKey, entry }
  } else {
    mode = { kind: "raw", query: positional[0], regex: rawRegex }
  }

  return {
    mode,
    minRank: minRankS ? parseInt(minRankS, 10) : 0,
    maxRank: maxRankS ? parseInt(maxRankS, 10) : Number.MAX_SAFE_INTEGER,
    limit: limitS ? parseInt(limitS, 10) : 20,
    source,
    json,
  }
}

function suggestAndExit(bad: string, keys: string[], flag: string): never {
  const scored = keys.map((k) => ({ k, d: levenshtein(bad, k) })).sort((a, b) => a.d - b.d)
  const suggestions = scored.slice(0, 3).map((s) => s.k)
  console.error(`Unknown ${flag} key: "${bad}"`)
  console.error(`Did you mean: ${suggestions.join(", ")}?`)
  process.exit(2)
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  return dp[m][n]
}

function loadSentences(sourceFilter: string | null): Sentence[] {
  if (!existsSync(DATA_DIR)) {
    console.error(`Error: ${DATA_DIR} does not exist.`)
    console.error(`Follow scripts/sentences/README.md to download at least one deck.`)
    process.exit(2)
  }

  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".tsv"))
  if (files.length === 0) {
    console.error(`Error: no .tsv files in ${DATA_DIR}.`)
    console.error(`Follow scripts/sentences/README.md to download at least one deck.`)
    process.exit(2)
  }

  let toRead: string[]
  if (sourceFilter) {
    const target = sourceFilter.endsWith(".tsv") ? sourceFilter : `${sourceFilter}.tsv`
    if (!files.includes(target)) {
      console.error(`Error: source "${sourceFilter}" not found in ${DATA_DIR}. Available: ${files.map((f) => f.replace(/\.tsv$/, "")).join(", ")}`)
      process.exit(2)
    }
    toRead = [target]
  } else if (files.includes(MERGED_FILE)) {
    toRead = [MERGED_FILE]
  } else {
    toRead = files
  }

  const sentences: Sentence[] = []
  for (const file of toRead) {
    const source = file.replace(/\.tsv$/, "")
    const raw = readFileSync(join(DATA_DIR, file), "utf8")
    const lines = raw.split(/\r?\n/)
    let lineNum = 0
    for (const line of lines) {
      if (!line.trim() || line.startsWith("#")) continue
      lineNum++
      const cols = line.split("\t")
      const fr = (cols[0] ?? "").trim()
      const en = (cols[1] ?? "").trim()
      if (!fr) continue
      const rank = cols[2] && cols[2].trim() ? parseInt(cols[2], 10) || lineNum : lineNum
      const src = (cols[3] ?? source).trim() || source
      sentences.push({ fr, en, rank, source: src })
    }
  }
  return sentences
}

function foldDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "")
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function buildMatcher(mode: Mode): (fr: string) => RegExp[] | null {
  // Returns the list of regexes that actually matched, or null if none.
  // All returned regexes carry the /g flag so highlightFr can iterate them safely.
  if (mode.kind === "raw") {
    if (mode.regex) {
      return (fr) => {
        const probe = new RegExp(mode.query, "iu")
        if (!probe.test(fr)) return null
        return [new RegExp(mode.query, "giu")]
      }
    } else {
      const needle = foldDiacritics(mode.query).toLowerCase()
      const probeSrc = `\\b${escapeRegex(needle)}\\b`
      return (fr) => {
        const folded = foldDiacritics(fr).toLowerCase()
        if (!new RegExp(probeSrc, "iu").test(folded)) return null
        return [new RegExp(`\\b${escapeRegex(mode.query)}\\b`, "giu")]
      }
    }
  }
  if (mode.entry.kind === "regex") {
    const regexes = mode.entry.patterns
    return (fr) => {
      const hits: RegExp[] = []
      for (const r of regexes) {
        const probe = new RegExp(r.source, r.flags.replace("g", ""))
        if (probe.test(fr)) {
          const flags = r.flags.includes("g") ? r.flags : r.flags + "g"
          hits.push(new RegExp(r.source, flags))
        }
      }
      return hits.length ? hits : null
    }
  }
  // keywords mode (vocab sub)
  const kws = mode.entry.keywords
  return (fr) => {
    const folded = foldDiacritics(fr).toLowerCase()
    const matched: RegExp[] = []
    for (const kw of kws) {
      const needle = foldDiacritics(kw).toLowerCase()
      if (folded.includes(needle)) {
        matched.push(new RegExp(escapeRegex(kw), "giu"))
      }
    }
    return matched.length ? matched : null
  }
}

function highlightFr(fr: string, hits: RegExp[]): string {
  // Union-highlight — wrap matched spans with ANSI yellow inverse.
  if (!hits.length) return fr
  const bounds: Array<[number, number]> = []
  for (const re of hits) {
    // Reset regex state — every re should be /g.
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(fr)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex++
        continue
      }
      bounds.push([m.index, m.index + m[0].length])
    }
  }
  if (!bounds.length) return fr
  bounds.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  // Merge overlapping.
  const merged: Array<[number, number]> = [bounds[0]]
  for (let i = 1; i < bounds.length; i++) {
    const [s, e] = bounds[i]
    const last = merged[merged.length - 1]
    if (s <= last[1]) last[1] = Math.max(last[1], e)
    else merged.push([s, e])
  }
  const YELLOW = "\x1b[33m\x1b[1m", RESET = "\x1b[0m"
  let out = "", cursor = 0
  for (const [s, e] of merged) {
    out += fr.slice(cursor, s) + YELLOW + fr.slice(s, e) + RESET
    cursor = e
  }
  out += fr.slice(cursor)
  return out
}

function describeMode(mode: Mode): string {
  if (mode.kind === "raw") return `${mode.regex ? "regex" : "literal"} "${mode.query}"`
  if (mode.kind === "pattern") return `--pattern ${mode.key}`
  return `--sub ${mode.key}`
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const sentences = loadSentences(args.source)
  const match = buildMatcher(args.mode)

  const results: Array<{ sentence: Sentence; hits: RegExp[] }> = []
  for (const s of sentences) {
    if (s.rank < args.minRank || s.rank > args.maxRank) continue
    const hits = match(s.fr)
    if (hits) results.push({ sentence: s, hits })
  }

  const total = results.length
  const shown = results.slice(0, args.limit)

  if (args.json) {
    console.log(JSON.stringify({
      mode: describeMode(args.mode),
      total,
      shown: shown.length,
      results: shown.map((r) => ({ rank: r.sentence.rank, fr: r.sentence.fr, en: r.sentence.en, source: r.sentence.source })),
    }, null, 2))
    return
  }

  if (total === 0) {
    console.log(`0 matches for ${describeMode(args.mode)} in ${args.source ?? "all sources"}.`)
    console.log(`Hints: widen --max-rank, try --regex for free-form, or check ${args.mode.kind === "pattern" ? "--pattern" : args.mode.kind === "sub" ? "--sub" : "the query"} spelling.`)
    return
  }

  const DIM = "\x1b[2m", RESET = "\x1b[0m"
  console.log(`${DIM}${total} match${total === 1 ? "" : "es"}${total > shown.length ? ` (showing ${shown.length})` : ""} — ${describeMode(args.mode)}${RESET}`)
  console.log()
  const rankW = Math.max(...shown.map((r) => String(r.sentence.rank).length), 4)
  for (const { sentence, hits } of shown) {
    const rank = String(sentence.rank).padStart(rankW, " ")
    const fr = highlightFr(sentence.fr, hits)
    const en = sentence.en ? `${DIM}→ ${sentence.en}${RESET}` : ""
    const srcTag = args.source ? "" : `${DIM} [${sentence.source}]${RESET}`
    console.log(`${DIM}${rank}${RESET}  ${fr}${srcTag}`)
    if (en) console.log(`${" ".repeat(rankW)}  ${en}`)
  }
}

main()
