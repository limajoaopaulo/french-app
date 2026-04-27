# French Adaptive Quiz — Starter Kit

Drop-in files for starting the project in Claude Code.

## What's in this kit

```
starter-kit/
├── README.md              ← you are here
├── CLAUDE.md              ← project spec (goes in project root)
├── schema.prisma          ← starter schema (goes in prisma/)
├── FIRST_PROMPT.md        ← paste into Claude Code on first run
└── data/
    ├── taxonomy.json          ← domains, subs, default active
    ├── contrast-pairs.json    ← 20 pattern pairs + rules
    ├── constants.json         ← scoring, bosses, thresholds
    └── seed-sample.json       ← 15 test questions
```

## Setup (run in your terminal)

```bash
# 1. Scaffold
npx create-next-app@latest french-quiz --typescript --tailwind \
    --eslint --app --src-dir --use-npm
cd french-quiz

# 2. Dependencies
npm install @prisma/client
npm install -D prisma tsx vitest @vitest/ui

# 3. Prisma init (creates prisma/ folder)
npx prisma init --datasource-provider sqlite

# 4. Copy starter files into the project
#    (adjust source path to wherever you downloaded this kit)
cp ../starter-kit/CLAUDE.md ./CLAUDE.md
cp ../starter-kit/schema.prisma ./prisma/schema.prisma
mkdir -p src/data
cp ../starter-kit/data/*.json ./src/data/

# 5. First commit
git init && git add . && git commit -m "initial scaffold + starter kit"

# 6. Launch Claude Code
claude
```

Then paste the contents of `FIRST_PROMPT.md` as your first message.

## Git hygiene

Add to `.gitignore`:

```
/prisma/dev.db
/prisma/dev.db-journal
.env.local
```

Keep `src/data/seed-sample.json` committed — the bank grows through
user action (manual question adding later), not through runtime APIs.

## Why no API key

This app deliberately has **no runtime LLM calls**. The prior artifact
version used the API for on-demand question generation; that added
latency, cost, and a whole class of failure modes (key exposure,
network flakiness, rate limits). For personal use, a pre-built bank
of ~1,000 curated questions beats infinite AI-generated ones.

When you want to add questions later, do it through the app's own
"add question" UI (to be built) or by editing `src/data/seed-sample.json`
and re-running `npm run seed`.
