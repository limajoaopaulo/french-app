# French Adaptive Quiz

## What this is

Personal French practice app. **All levels, A1 through C1** — not
B2-specific. Diagnoses the user's weaknesses from actual answer data
and drills them. Sekiro-inspired loop:

1. **Train** — personalised drill targets data-identified weak spots
2. **Review** — spaced-repetition queue surfaces due items
3. **Fight bosses** — A2/B1/B2/C1 gauntlets to mark real progress

Pre-generated question bank. No runtime API calls. No API key needed.

## Why data-driven feedback is a core feature

The whole point of this app (over Duolingo, Anki, etc.) is that it
actually tells the user *what they're bad at and why*. Surfacing that
is not a nice-to-have — it's the product. Four must-have data surfaces:

1. **Per-sub level estimate** — decimal 1.0 to 5.0, not a tag.
   Updated after every answer via `level_estimate_delta` in constants.
2. **Regression signal** — older-vs-newer accuracy split on last 20
   answers per sub. Drives personalised drill selection.
3. **Pattern misses** — cumulative across sessions. Triggers
   "Difficultés récurrentes" home card at 3+ misses for same pattern.
4. **Per-session callout** — any pattern missed 2+ times in the
   session is named on the end screen.

## Stack

- Next.js 15 (App Router) + TypeScript
- SQLite via Prisma — `prisma/schema.prisma` is source of truth
- Single-user local app; no auth
- No runtime LLM; everything local

## Data files (provided)

All in `src/data/`, checked into git:

- `taxonomy.json` — domains, subs, labels, default-active subs
- `contrast-pairs.json` — 20 pattern pairs + pairing rules (70% prob)
- `constants.json` — scoring, baskets, boss composition, thresholds
- `seed-sample.json` — ~15 test questions. NOT the real bank; user
  will grow the bank over time. App must work with this minimal set.

## Taxonomy summary

- **Grammar subs (8):** conjugation, pronouns, prepositions, subjunctive,
  negation, articles, reported, interrogation
- **Vocabulary subs (13):** daily, work, academic, cooking, sport,
  travel, health, emotions, admin, news, idioms, connectors, register
- **Levels:** 1 (A1) → 5 (C1)
- **Default active on first launch** (from `taxonomy.json`):
  - grammar: conjugation, pronouns, prepositions, subjunctive
  - vocabulary: daily, work, academic, sport, register, connectors

## Question schema

See `seed-sample.json._schema`. Key fields: `domain`, `sub`, `level`,
`pattern`, `counterpart?`, `cue_type`, `cue`, `options[4]`,
`correct_index`, `explanation`, `register?`.

## Two-stage answer

Every question has a **confidence commit** before options are shown:

1. User sees cue → taps "Je suis confiant" or "Je ne sais pas"
2. Options appear → user picks
3. Explanation shown → user taps to advance

Confidence affects scoring (see `constants.json.scoring_rules`).

## Home screen (in order, no other zones)

1. Domain filter chips (Grammaire / Vocabulaire / Tout)
2. **Drill personnalisé** — headline. 10/15/20 Q picker. Runs
   `computePersonalisedTargets` logic.
3. **Révision** — visible only when Leitner queue has due items
4. **Difficultés récurrentes** — visible only when any pattern has 3+ misses
5. **Arène des boss** — 8 cards (grammar A2/B1/B2/C1 + vocab A2/B1/B2/C1)
6. **Drill manuel** — collapsed by default. Sub picker + level override
   + 10/15/20 length
7. **Sessions récentes** — recent history

**DO NOT build:** thematic drills, auto drill, separate assessment,
free play. These were removed from the artifact intentionally.

## Bosses

- Strict **2-miss cap at every level**. Gold=0, Silver=1, Bronze=2.
- Composition **shuffled at session start** (no sequential blocks):
  - A2: 20 A2
  - B1: 10 A2 + 20 B1 = 30
  - B2: 10 A2 + 15 B1 + 20 B2 = 45
  - C1: 10 A2 + 15 B1 + 20 B2 + 25 C1 = 70
- Unlock rule: boss level L is unlocked when **every active sub in
  that domain** has `estimatedLevel >= L`.
- Contrast pairing **disabled** in bosses.

## Contrast pairing

From `contrast-pairs.json`. In personalised and manual drills only,
after each answer: 70% probability next question is drawn from the
bank where `pattern === counterpart_of_prior_pattern`, if such a
question exists and hasn't been served in this session.

**Disabled in:** bosses, review mode.

## Scoring at a glance

- Base points per correct = `LEVEL_POINTS[level]` (A1=0.25 → C1=4.0)
- Confidence multiplier only when correct AND confident
- Correct + `speedTag === "fast"` gets a small silent +10% bonus
  (`fast_correct_multiplier`). No UI feedback, no slow-penalty.
- Session rank = points per question (not per minute — no timer displayed)
- Rank tiers: Diamond 5+, Platinum 3.5+, Gold 2+, Silver 1+, Bronze <1
- `wrong_unsure` level-estimate delta is −0.30 (softened from −0.50) so
  ~80% accuracy slow-climbs (~+0.06/Q) instead of plateauing at A1.

See `constants.json.scoring_rules` for exact deltas.

## CRITICAL carryover bugs from the artifact

These burned real time in the artifact. Write tests FIRST.

### 1. Shuffle correctness

The artifact had "correct answer is always position A" because the
shuffled question object and the answer-handler closure got out of
sync. Before writing any UI:

- Port `shuffleOptions(q)` (Fisher-Yates) to `src/lib/shuffle.ts`
- Write a Vitest unit test: shuffle the same question 1000 times,
  assert `correct_index` distribution is ~25% at each position
  (±3% tolerance).
- Write a component test: render the question, confirm the correct
  option's visible text matches `options[correct_index]` after shuffle.

### 2. No dead-code blocks

The artifact accumulated features via `{false && (<div>…</div>)}`
hiding to remove UI. Do not do that here. If a mode is removed from
scope, delete its JSX and routes. The home screen has exactly the
zones listed above — no more.

### 3. State closure on serveNext

The artifact's bug was partly in how the question object flowed from
`serveNext` through state into the answer handler. Use a single
source of truth (React state with the already-shuffled question)
and pass it explicitly to handlers.

## Conventions

- DB access only via `src/lib/db.ts` (Prisma singleton)
- Mutations via server actions, not API routes (unless mobile-style
  needed later)
- Zod schemas for all API/action I/O
- No `any`. No dead code.
- Components < 200 lines. Split when larger.
- French UI strings in `src/lib/i18n.ts` (even though single-user, it
  keeps strings out of JSX for grep-ability)

## Commands

- `npm run dev` — start dev server
- `npm run seed` — load `seed-sample.json` into DB (idempotent)
- `npm run test` — Vitest
- `npx prisma studio` — inspect DB
- `npx prisma migrate dev --name <name>` — after schema change

## Current focus (build order)

1. Prisma schema + first migration
2. Seed loader (`scripts/seed.ts`) that ingests `seed-sample.json`
3. Shuffle helper + unit test (1000-iter uniformity check)
4. Minimal personalised drill end-to-end (home → start → answer one
   question with two-stage commit → see explanation → Leitner + stats
   update → session end with rank)
5. Home screen with all zones (hide Révision/Difficultés when empty)
6. Manual drill
7. Boss runtime (shuffled composition, 2-miss cap, medal award)
8. Contrast pairing in personalised/manual
9. Stats page (per-sub level estimates, pattern misses, recent sessions)

## Deferred (do not build now)

- Generation step (pause-to-produce before options)
- Elaboration button ("pourquoi ?") expanding explanation
- Post-session reflection prompt
- Desirable-difficulty tuning (nudge harder when accuracy >80%)
- Per-word vocabulary familiarity tracking (Lingvist-style)
- Top-100-words / top-20-verbs curated drills
- Audio/listening questions
- On-demand question generation via API (explicitly out of scope)
