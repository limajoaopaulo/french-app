# Sentence corpus — authoring helper

Dev-only tool. It does **not** ship with the app and has no runtime hook.

When authoring new MCQs for `src/data/seed-sample.json`, the slowest step is inventing a natural, level-appropriate French *cue* sentence. This helper searches an external corpus of FR↔EN sentence pairs so I can grab real sentences matching a target grammar pattern or vocab sub-pattern, then hand-author distractors + explanation as usual.

## Setup (one-time)

Install Anki desktop (<https://apps.ankiweb.net/>), download at least deck 1 below, then export each to TSV as described.

### Recommended decks (free, community)

| # | Deck | AnkiWeb ID | Why |
|---|------|------------|-----|
| 1 | Neri — *5000 French Sentences sorted from Easiest to Hardest* | `1089240419` | Primary. FR↔EN, ≤6 words, sorted by AFRN (Average Frequency Rank Number). |
| 2 | Neri — *French Sentences* (16 000 extended) | `1416412430` | Longer sentences. Needed for patterns that require subclauses (`pc-vs-imparfait`, `reported-passe`, `si-type2`) and rarely fit in 6 words. |
| 3 | *5000 most frequently used French words v6.0* | `893324022` | Word-focused with example sentences. Useful when authoring vocab subs. |

URLs: `https://ankiweb.net/shared/info/<ID>`.

### Export to TSV

For each deck, in Anki Desktop:

1. Open the deck.
2. *File → Export…*
3. Export format: **Notes in Plain Text (.txt)**.
4. Include: tags = off, HTML = off. Cards/fields = default.
5. Save under `scripts/sentences/data/` with one of these names (the CLI uses the filename stem as the `--source` value):
   - Deck 1 → `fr-5000.tsv`
   - Deck 2 → `fr-16000.tsv`
   - Deck 3 → `fr-freq-5000.tsv`
6. Open the file in a text editor — if Anki exported a header or extra columns, make sure the first two tab-separated columns are FR then EN. Strip any HTML tags left behind if Anki's HTML toggle didn't catch them.

### Optional: merge into one file

If you have multiple TSVs, concatenate them into `data/merged.tsv` so the CLI reads everything by default:

```bash
cat scripts/sentences/data/fr-5000.tsv scripts/sentences/data/fr-16000.tsv > scripts/sentences/data/merged.tsv
```

Without `merged.tsv`, the CLI reads all TSVs in `data/` automatically.

### Messy merges — use `ingest.ts`

If you already have a concatenated Anki export (multiple decks joined, Wiktionary noise, conjugation cards mixed in), run the ingest script instead of hand-cleaning:

```bash
npx tsx scripts/sentences/ingest.ts /path/to/your/merged.txt
```

This writes a cleaned `data/fr-merged.tsv`. It:

- Splits each row on runs of 2+ spaces (Anki inter-field gap).
- Drops conjugation cards (`VERB[tense]` format).
- Drops Wiktionary/DeepL/"view on Wiktionary" metadata fragments.
- Drops pronunciation-trainer rows ("play buttons", "audio samples", "back of the card").
- Rejects syllable-drill rows (many commas + no long tokens).
- Requires ≥3 real word tokens per sentence.
- Classifies each remaining chunk as FR or EN by French-accent density and stopword count.
- Pairs the top-FR with top-EN chunk per row.
- Dedups on normalized FR.

Reports input/emit/skip counts when done. Expect ~30–50% of source rows to be emitted as usable pairs from a noisy merge.

**Known limitation:** a few hundred head rows (roughly rank ≤500) may still be Wiktionary-style grammar-notes dict entries that my noise patterns missed — they come from one specific noisy deck. Use `--min-rank 500` when searching to skip them:

```bash
npx tsx scripts/sentences/search.ts --pattern relatif-dont --min-rank 500 --limit 10
```

### Paid decks (optional upgrades)

Surveyed but **not** included in the default shortlist. Add them later if you buy them — the CLI will pick up any new TSV you drop in `data/`:

- **Languages on Fire — Ultimate French Deck** (CEFR-structured, curated sentences, audio).
- **Speakada — French Grammar Bundle** (A0 through C1, explicit CEFR tagging that would map cleanly to our `level` 1–5).

## Data format

TSV columns: `fr\ten[\trank][\tsource]`

- `fr` — required. The French sentence.
- `en` — translation. Blank allowed.
- `rank` — optional integer. If missing, the CLI uses the line number within the file.
- `source` — optional string. If missing, the filename stem is used.

AFRN rank windows map roughly to CEFR:

| AFRN rank | Suggested CEFR / `level` |
|-----------|--------------------------|
| 1–1000    | A1 (1) |
| 1001–2000 | A2 (2) |
| 2001–3500 | B1 (3) |
| 3501–4500 | B2 (4) |
| 4501–5000 | C1 (5) |

This is a heuristic for the *sentence*, not the *question*. Final `level` depends on the target pattern (a C1 pattern inside an A1-ranked sentence is still a C1 question).

## Usage

```bash
# Literal (word-boundary, case + diacritic insensitive)
npx tsx scripts/sentences/search.ts "dont" --max-rank 2000 --limit 10

# Grammar pattern library
npx tsx scripts/sentences/search.ts --pattern relatif-dont --limit 10
npx tsx scripts/sentences/search.ts --pattern si-type2 --source fr-16000

# Vocab keyword library
npx tsx scripts/sentences/search.ts --sub admin_bureaucracy/banque-compte --limit 10

# Regex
npx tsx scripts/sentences/search.ts "^Je n.*pas" --regex --limit 5

# Machine-readable
npx tsx scripts/sentences/search.ts --pattern ne-rien --json
```

Other flags: `--min-rank N`, `--max-rank N`, `--source <stem>`, `--help`.

## Limitations — important

**Regex-based grammar matching has false positives.** E.g. `pc-avoir` catches "il a mangé" (good) but also "il a froid" (not a PC — "froid" isn't a past participle). Every hit must be manually reviewed.

**Some patterns are rare in ≤6-word sentences.** `pc-vs-imparfait` (needs both tenses), `reported-passe` (needs a subclause), some C1 patterns. For those, prefer `--source fr-16000` or expect to hand-author the cue.

**Vocab matching is keyword-only, noisy.** A sentence with "banque" might be the `banque-compte` sub-pattern or metaphorical. The helper narrows the haystack; I classify.

**Modification is expected, not optional.** Results are drafts. Freely shorten, swap tense, change register, add context, or grep again. The helper is not a classifier and not a question generator — it's a sentence *prospecting* tool.

**Diacritics and elision.** Patterns were tuned for French apostrophe elision (`n'a`, `j'étais`) and accented word-endings (`mangé`, `étais`). Literal-query mode folds diacritics so `decu` matches `déçu`. Regex mode does not — supply accents yourself.

## License

Community Anki decks distribute "free of charge" but without an explicit license grant. Consequence:

- `scripts/sentences/data/` is **gitignored**. The raw corpus is not redistributed with the app.
- Each contributor downloads their own copy.
- Original sentences, once pulled into a hand-authored MCQ and modified, are considered authoring inspiration — consistent with fair-use dictionary/corpus reference practice. If this ever becomes a concern, we revisit.

## Authoring workflow

1. Pick a target pattern/sub in the current authoring batch (e.g. thin `relatif-dont` at C1).
2. Run `npx tsx scripts/sentences/search.ts --pattern relatif-dont --min-rank 4000 --limit 20`.
3. Skim 5–10 hits. Pick one that reads naturally and tests what you want.
4. Optionally modify (shorten, adjust tense, swap register).
5. Paste into the new MCQ's `cue` field. Author 4 options + `explanation` + `correct_index` as usual.
6. Append to `src/data/seed-sample.json`, run `npm run coverage` to confirm the new bucket filled.

If after ~20 new MCQs with the helper available you're still inventing cues from scratch, the helper failed — delete it rather than leave dead code.

## Files

- `patterns.ts` — taxonomy slug → regex / keyword library. Extend when you find recurring false positives or want new patterns.
- `search.ts` — the CLI itself. ~250 lines, no deps beyond what `npm run coverage` already uses.
- `data/` — gitignored. Your local TSVs.
