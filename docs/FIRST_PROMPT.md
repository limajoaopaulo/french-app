# First prompt to paste into Claude Code

After scaffolding the project (see README.md), launch Claude Code with
`claude` in the project root, and paste the following message verbatim:

---

Read these files in order before doing anything else:

1. `CLAUDE.md` (project spec)
2. `prisma/schema.prisma` (starter schema with open questions marked `// ?`)
3. `src/data/taxonomy.json`
4. `src/data/contrast-pairs.json`
5. `src/data/constants.json`
6. `src/data/seed-sample.json`

Three non-obvious points to internalize:

1. This is a **general French practice app, all levels A1–C1**. Not
   B2-specific. Diagnose weaknesses wherever they are.
2. **Data-driven feedback (per-sub level estimates, regression, pattern
   misses, baskets) is the core feature**, not an afterthought. It's
   the reason this app exists over Duolingo.
3. **Known carryover bugs** from the artifact this replaces:
   (a) shuffle correctness — correct-answer position was always "A"
   due to closure capture. Write the uniformity test FIRST before any
   UI. (b) dead-code blocks via `{false && (...)}` — don't. Delete JSX
   that's not in scope.

Before writing any runtime code, produce a plan with:

A. **Schema refinements** — answer the `// ?` open questions in
   `schema.prisma`, and propose any additions (missing indices,
   fields I forgot, etc.).

B. **`src/` file structure** — full tree you intend to create, with
   one-line purpose per file. Don't create the files yet; just the tree.

C. **Shuffle test plan** — the exact Vitest test you'll write before
   touching UI. Pseudocode is fine.

D. **Minimal end-to-end slice** — the smallest thing that proves the
   stack works: load seed-sample.json into DB, start a personalised
   2-question session, answer one question with two-stage commit
   (confidence → options → explanation), see Leitner/basket/SubStats
   update correctly, see session-end rank screen. List the files and
   routes this slice needs.

E. **Questions for me** — anything ambiguous in CLAUDE.md or the data
   files that you want me to decide before building.

Do NOT write code in this first response. Plan only. I'll review and
say "go" (possibly with tweaks) before you start implementing.
