# Multi-user + multi-language deploy plan

## Context

Today the app is single-user, hardcoded French, uses a local SQLite file, no auth. Goal: make it shareable via a public URL, with per-user progress, and support both French and Portuguese learners. Decisions already made:

- **Hosting:** Vercel + Turso (hosted libSQL — SQLite-compatible, keeps Prisma minimal).
- **Identity:** username + 4-digit PIN. No passwords, no email, no OAuth.
- **Languages:** **one language per user** (picked at signup — FR or PT). To study both, create two accounts. This keeps scoping simple (language flows from the user).
- **UI language:** **English** for all users. Quiz content stays in target language (French or Portuguese); interface chrome is English.
- **Data layout:** per-language folders — `src/data/fr/*` (taxonomy, contrast-pairs, seed bank) and `src/data/pt/*`. `constants.json` stays shared.
- **Existing data:** start fresh (wipe Sessions/Reviews/PatternMiss; reset SubStats/PatternStats; keep existing French Question bank, re-tagged with language="fr").

## Step 1 — Schema: add Language + User, scope everything

New `Language` table (seeded once on migrate):

```prisma
model Language {
  id    Int    @id @default(autoincrement())
  code  String @unique   // "fr" | "pt"
  name  String           // "Français" | "Português"

  users     User[]
  questions Question[]
}
```

New `User` model:

```prisma
model User {
  id          Int      @id @default(autoincrement())
  username    String   @unique          // lowercased on write
  displayName String
  pinHash     String                     // bcrypt hash of 4-digit PIN
  languageId  Int                        // locked at signup
  language    Language @relation(fields: [languageId], references: [id])
  createdAt   DateTime @default(now())

  sessions      Session[]
  subStats      SubStats[]
  patternStats  PatternStats[]
  patternMiss   PatternMiss[]
  reviews       Review[]
  questionState QuestionState[]

  @@index([username])
  @@index([languageId])
}
```

Add `languageId Int` + `language Language @relation(...)` to `Question` — the question bank is split by language, not by user.

Add `userId Int` + `user User @relation(...)` to: `Session`, `SubStats`, `PatternStats`, `PatternMiss`, `Review`, `QuestionState`. Since each user is locked to one language, per-user rows inherit the language transitively — no separate `languageId` needed on those tables.

Update uniques:
- `SubStats`: `@@unique([userId, domain, sub])`
- `PatternStats`: `@@unique([userId, domain, sub, pattern])`
- `QuestionState`: `@@unique([userId, questionId])` (replaces `questionId @unique`)

**Migration:** we're starting fresh, so wipe Session/Review/PatternMiss/SubStats/PatternStats/QuestionState before migrating. Existing `Question` rows get a `languageId = <fr.id>` backfill via a small data-migration SQL block inside the migration file (or do it via `scripts/reset.ts` before running `prisma migrate dev --name multi_user_and_language`).

## Step 2 — Auth layer + welcome flow

`src/lib/auth.ts`:
- `hashPin(pin: string): Promise<string>` — bcrypt, cost 10
- `verifyPin(pin: string, hash: string): Promise<boolean>`
- `setSessionCookie(userId: number)` — httpOnly signed cookie, 90-day expiry (SameSite=Lax, Secure in prod)
- `getCurrentUser(): Promise<User & { languageCode: string } | null>` — reads cookie, joins Language, returns user + language code
- `requireUser()` — throws if not signed in (used by server actions)

Cookie secret via `AUTH_SECRET` env var. Sign with HMAC-SHA256 via `jose` or `iron-session`.

`src/app/welcome/page.tsx` — landing if not signed in. Three-step signup OR single-step sign-in:
1. **Pick your language** — two cards: 🇫🇷 French / 🇵🇹 Portuguese.
2. **Claim a username + display name**.
3. **Pick a 4-digit PIN**.

Sign-in tab: just username + PIN (language is looked up from the stored user row).

Server actions in `src/app/actions/auth.ts`:
- `createAccount({ username, displayName, pin, languageCode })` — validate unique, resolve `languageCode → languageId`, hash PIN, create user, **call `seedUserProgress(userId)` to populate default SubStats + PatternStats rows from that language's taxonomy**, set cookie, return success.
- `signIn({ username, pin })` — lookup, verify PIN (rate-limit via in-memory bucket: 5 attempts / 10 min per username), set cookie.
- `signOut()` — clear cookie.
- `switchUser()` — alias for signOut + redirect to `/welcome`.

## Step 3 — Scope every existing action by user AND language

Per-user scoping (mechanical):
- `src/app/actions/session.ts` — every `prisma.session.*`, `prisma.subStats.*`, `prisma.patternStats.*`, `prisma.review.*`, `prisma.questionState.*`, `prisma.patternMiss.*` call gets `userId: user.id`.
- `src/lib/stats.ts` — `updateSubStats`, `updatePatternStats` take userId.
- `src/lib/leitner.ts` — `applyOutcome` takes userId (`QuestionState` is per-user now).
- `src/lib/progression.ts` — `computeUnlockedBossLevels`, `pickPersonalisedTargets`, `applyBossDefeatSkillLoss` all take userId.

Language-scoping (new):
- `src/lib/serve.ts` — both `pickNextQuestion` and `pickBossQuestion` must filter `Question` by `languageId = user.languageId`. The SubStats filter (already per-user) transitively restricts to the user's language.
- `src/lib/taxonomy.ts` — today reads a single `taxonomy.json`. Refactor to `getTaxonomy(languageCode): Taxonomy`, loading from `src/data/{fr,pt}/taxonomy.json`.
- `src/lib/contrastPairs.ts` (new or renamed) — `getContrastPairs(languageCode)` reads from `src/data/{fr,pt}/contrast-pairs.json`.
- Every call site that reads taxonomy/contrast-pairs must thread the user's language through.

New helpers in `src/lib/userStats.ts`:
- `seedUserProgress(userId)` — loads the user's language's taxonomy, creates default SubStats + PatternStats rows for every domain/sub/pattern, sets `isActive` per the language's `default_active`. Called once from `createAccount`.

Home page + Stats page: scope all reads by current user (userId gives language for free).

## Step 4 — UI: English chrome + signed-in header

Convert `src/lib/i18n.ts` from hardcoded French to English:

- Rename all strings to English (`"Entraînement"` → `"Training"`, `"Terminer l'entraînement ?"` → `"End drill?"`, rank names stay stylized: Diamant/Platine/Or stay or become Diamond/Platinum/Gold — recommend switch to English for consistency).
- Keep the structured `t.home`, `t.session`, `t.end`, `t.boss`, `t.stats`, `t.settings`, `t.ranks` shape so no component changes.
- Target-language content in the question bank (cue, options, explanation) stays in FR/PT — this is what's being learned.
- One French-only string to keep: the `firstEncounter` badge makes sense in target language — or just translate it to English ("New"). Go English.

Signed-in header (root layout):
- Right side: `Bonjour, {displayName}` → "Hi, {displayName} · {languageCode.toUpperCase()} · Switch user" (e.g. "Hi, Joao · FR · Switch user"). Click "Switch user" → `signOut` → `/welcome`.
- Home page wrapped in a "requires user" server component guard (redirects to `/welcome` if no cookie).
- Welcome page: language picker, signup form, signin form — all English copy.

## Step 5 — Split data into per-language folders

Reorg:

```
src/data/
  constants.json            # unchanged, shared
  fr/
    taxonomy.json           # was: src/data/taxonomy.json
    contrast-pairs.json     # was: src/data/contrast-pairs.json
    seed.json               # was: src/data/seed-sample.json (renamed)
  pt/
    taxonomy.json           # NEW — grammar subs reworked for PT
    contrast-pairs.json     # NEW — PT-specific pairs
    seed.json               # NEW — user will grow this over time; start small
```

Update:
- `src/lib/taxonomy.ts` — `getTaxonomy(languageCode)` with inline `import fr from "@/data/fr/taxonomy.json"`, same for pt.
- `src/lib/contrastPairs.ts` (new file) — same pattern.
- `scripts/seed.ts` — iterate over `["fr", "pt"]`, upsert each `Language` row, then upsert Questions per language with `languageId`.
- `scripts/ingest.ts` (Anki pipeline) — accept `--language fr|pt` flag. User will run PT decks through the same pipeline.

Portuguese seed: user said they'll provide Anki decks and generate questions. Start with an empty `pt/seed.json` (schema + zero questions). App should handle "no questions for this language yet" gracefully → welcome page could flag "PT bank is small — come back soon" or hide PT from the language picker until it has ≥N questions.

## Step 6 — Turso migration

Dev:
```bash
turso auth login
turso db create quiz-app
turso db show quiz-app --url           # libsql://...
turso db tokens create quiz-app        # auth token
```

In `.env.production`:
```
DATABASE_URL=libsql://quiz-app-<user>.turso.io
DATABASE_AUTH_TOKEN=<token>
AUTH_SECRET=<64-char random>
```

Swap the Prisma adapter:
- Uninstall `@prisma/adapter-better-sqlite3` + `better-sqlite3`.
- Install `@libsql/client` + `@prisma/adapter-libsql`.
- Update `src/lib/db.ts`: `new PrismaLibSQL({ url, authToken })`.
- Update `scripts/seed.ts` + `scripts/reset.ts` similarly.

Schema stays `provider = "sqlite"` (Turso speaks SQLite).

Push schema + seed to Turso once:
```bash
DATABASE_URL=$TURSO_URL DATABASE_AUTH_TOKEN=$TURSO_TOKEN npx prisma migrate deploy
DATABASE_URL=$TURSO_URL DATABASE_AUTH_TOKEN=$TURSO_TOKEN npm run seed
```

Local dev keeps using `file:./prisma/dev.db` via a separate `.env.local`.

## Step 7 — Vercel deploy

Rename repo (cosmetic but earns clarity since it's no longer French-only): `french-app` → `adaptive-quiz` or similar.

```bash
gh repo create adaptive-quiz --private --source=. --push
# On vercel.com: Import project, set env vars DATABASE_URL, DATABASE_AUTH_TOKEN, AUTH_SECRET
```

Add `vercel.json` only if needed (should work out of the box with Next.js 15).

Share URL → done.

## Step 8 — Verification

1. `npm run test` — all green locally (SQLite file).
2. Local dev: sign up as "joao" picking 🇫🇷 French, PIN 1234 → play 10Q drill → progress saved. Sign out. Sign up as "maria" picking 🇵🇹 Portuguese, PIN 4321 → verify only PT questions are served → progress saved separately.
3. Verify cross-contamination: as "joao" (FR), confirm stats page shows only FR questions answered; no PT rows leak in.
4. Deploy preview on Vercel against Turso → same flow.
5. Guess another user's PIN: "joao" + 0000 → fails; 5 attempts in 10min → rate-limited.

## Estimated scope

~1.5 days of focused work. Order to ship in:
1. Schema + wipe + migration (Language + User + scoping) (45 min)
2. Data reorg into `fr/` + stub `pt/` folders (30 min)
3. Taxonomy/contrast-pair loaders accept languageCode (1 hr)
4. Auth lib + welcome page w/ language picker + auth server actions (2.5 hr)
5. Scope every existing action by userId + language filter on Question queries (3 hr)
6. i18n.ts → English (1 hr)
7. UI header + sign-out (30 min)
8. Turso + Vercel setup (1 hr)
9. Smoke test both languages + fix scoping bugs (1 hr)

## Open questions

- **PIN recovery:** If someone forgets their 4-digit PIN, there's no email to reset to. Options: (a) tell them to sign up fresh under a new username, (b) you manually edit the DB. Acceptable for friends-and-family; flag if you want to build a recovery flow later.
- **Username uniqueness is global across languages:** "joao" taken by the FR account means a PT learner can't pick "joao". Fine at this scale; if it matters, make uniqueness `@@unique([languageId, username])`.
- **Rate limiting:** Keep in-memory for now. Fine on Vercel until you get many attackers; then move to Upstash Redis or a DB table.
- **Studying both languages:** Current plan requires two accounts. If later you want a single account with multiple languages, the refactor is: add `languageId` to every per-user table, add a language-switcher in the header, and change unique constraints to include it. Manageable but not free.
- **Repo + package name:** `french-app` / `"name": "french-app"` in package.json. Rename to something neutral like `adaptive-quiz` before deploy so the Vercel URL and GitHub repo don't mislead. Cosmetic but recommended.
- **CLAUDE.md:** the whole file is written as "French Adaptive Quiz". Needs a rewrite pass to describe a two-language app. Low priority until after deploy.
- **Portuguese taxonomy authoring:** Portuguese grammar subs aren't 1:1 with French. The PT `taxonomy.json` needs its own pattern list (no subjunctive triggers matching French's, different pronoun shape, etc.). You'll need to draft this before real PT questions land — budget an afternoon with references.
