// AI-based question-bank audit. Uses Sonnet 4.6 to review each question and
// propose fixes for: (a) cue telegraphs the answer's verb form,
// (b) options lost trailing context after the suffix-strip pass,
// (c) explanation restates the cue/answer redundantly.
//
// Prompt caching pins the system prompt + rules so repeat batches read at ~0.1×.
// Batches are 10–20 questions per call to amortize the cached prefix.
//
// Run:
//   ANTHROPIC_API_KEY=... npx tsx scripts/ai-audit.ts <seed.json> [--apply] [--limit=N] [--batch-size=15] [--start=0]
//
// Defaults to dry-run. --apply writes proposed fixes back to the file.

import fs from "node:fs"
import path from "node:path"
import Anthropic from "@anthropic-ai/sdk"

interface Question {
  id: string
  domain: string
  sub: string
  level: number
  pattern: string
  counterpart?: string
  cue_type: string
  cue: string
  options: string[]
  correct_index: number
  explanation: string
  register?: string
}

interface Seed {
  questions: Question[]
  [key: string]: unknown
}

interface ProposedFix {
  id: string
  needs_fix: boolean
  reason?: string
  cue?: string
  cue_type?: string
  options?: string[]
  explanation?: string
}

const RULES = `You are auditing French/Portuguese language quiz questions for a self-study app.

For each question, decide whether it needs a fix on three axes:

(a) CUE TELEGRAPHING — the cue contains the same conjugated verb form as the correct option, giving away the answer. The fix is to replace the leaked form with an infinitive in parens, e.g. "Dire que tu lisais beaucoup" → "Dire que tu (lire) beaucoup". Lexical noun matches (e.g. "Paris", "café") are FINE — only verb-form leaks count.

(b) OPTIONS LOST CONTEXT — earlier we stripped trailing context from options for brevity (e.g. "J'habite à Paris avec ma famille." → "J'habite"). Some became too terse to convey meaning. The fix here depends:
   - If the cue is "Say: «English intent»" and the options are bare verb fragments: REFRAME the question as cue_type="gap_fr" with a French gap-form cue (e.g. cue="J'___ à Paris avec ma famille.", options stay as fragments).
   - If the cue is already French and provides context: leave options as-is (the diff highlighter shows what differs).

(c) EXPLANATION RESTATES — explanation just repeats the answer instead of giving the rule. Trim to a one-sentence rule. Multi-rule explanations with distractor labels are FINE — keep them.

Style guide for cue rewrites (when needed):
- Use "(infinitive)" parens to signal the verb form to produce
- Keep subject pronouns (Tu/Je) so the user knows whose conjugation to use
- For pronoun-replacement tests, append "(sans répéter « X »)"
- For literary/register tests, lead with "Style littéraire:" or "Registre soutenu:"

Output format: a JSON array, one object per question, in the SAME ORDER as input.
Each object: {"id": "...", "needs_fix": bool, "reason": "...", "cue": "...", "cue_type": "...", "options": [...], "explanation": "..."}
Only include the fields you're changing. If needs_fix is false, output {"id": "...", "needs_fix": false}.
Be conservative — only propose a fix when there's a clear improvement. Doubt → leave alone.`

const SCHEMA = {
  type: "object",
  properties: {
    fixes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          needs_fix: { type: "boolean" },
          reason: { type: "string" },
          cue: { type: "string" },
          cue_type: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          explanation: { type: "string" },
        },
        required: ["id", "needs_fix"],
        additionalProperties: false,
      },
    },
  },
  required: ["fixes"],
  additionalProperties: false,
}

function formatQuestion(q: Question): string {
  return JSON.stringify(
    {
      id: q.id,
      cue_type: q.cue_type,
      cue: q.cue,
      options: q.options,
      correct: q.options[q.correct_index],
      explanation: q.explanation,
    },
    null,
    0,
  )
}

async function auditBatch(
  client: Anthropic,
  batch: Question[],
): Promise<ProposedFix[]> {
  const userText =
    `Audit these ${batch.length} questions and return the JSON array.\n\n` +
    batch.map((q) => formatQuestion(q)).join("\n")

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: RULES,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userText }],
    output_config: {
      format: { type: "json_schema", schema: SCHEMA },
    },
  })

  const textBlock = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text",
  )
  if (!textBlock) throw new Error("no text block in response")

  const cacheRead = response.usage.cache_read_input_tokens ?? 0
  const cacheWrite = response.usage.cache_creation_input_tokens ?? 0
  console.log(
    `  [tokens: in=${response.usage.input_tokens} cache_read=${cacheRead} cache_write=${cacheWrite} out=${response.usage.output_tokens}]`,
  )

  const parsed = JSON.parse(textBlock.text) as { fixes: ProposedFix[] }
  return parsed.fixes
}

function diff(orig: Question, fix: ProposedFix): string {
  const lines: string[] = []
  if (fix.cue && fix.cue !== orig.cue) {
    lines.push(`  cue:   - ${orig.cue}`)
    lines.push(`         + ${fix.cue}`)
  }
  if (fix.cue_type && fix.cue_type !== orig.cue_type) {
    lines.push(`  type:  ${orig.cue_type} → ${fix.cue_type}`)
  }
  if (fix.options && JSON.stringify(fix.options) !== JSON.stringify(orig.options)) {
    lines.push(`  opts:  - ${JSON.stringify(orig.options)}`)
    lines.push(`         + ${JSON.stringify(fix.options)}`)
  }
  if (fix.explanation && fix.explanation !== orig.explanation) {
    lines.push(`  exp:   - ${orig.explanation}`)
    lines.push(`         + ${fix.explanation}`)
  }
  return lines.join("\n")
}

function applyFix(q: Question, fix: ProposedFix): Question {
  return {
    ...q,
    ...(fix.cue !== undefined && { cue: fix.cue }),
    ...(fix.cue_type !== undefined && { cue_type: fix.cue_type }),
    ...(fix.options !== undefined && { options: fix.options }),
    ...(fix.explanation !== undefined && { explanation: fix.explanation }),
  }
}

async function main() {
  const argv = process.argv.slice(2)
  const file = argv[0]
  const apply = argv.includes("--apply")
  const limitArg = argv.find((a) => a.startsWith("--limit="))
  const startArg = argv.find((a) => a.startsWith("--start="))
  const batchSizeArg = argv.find((a) => a.startsWith("--batch-size="))
  const limit = limitArg ? parseInt(limitArg.split("=")[1]) : Infinity
  const start = startArg ? parseInt(startArg.split("=")[1]) : 0
  const batchSize = batchSizeArg ? parseInt(batchSizeArg.split("=")[1]) : 15

  if (!file) {
    console.error(
      "usage: tsx scripts/ai-audit.ts <seed.json> [--apply] [--limit=N] [--start=N] [--batch-size=15]",
    )
    process.exit(1)
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("error: ANTHROPIC_API_KEY env var required")
    process.exit(1)
  }

  const abs = path.resolve(file)
  const seed = JSON.parse(fs.readFileSync(abs, "utf8")) as Seed

  const questions = seed.questions.slice(start, start + Math.min(limit, seed.questions.length - start))
  console.log(`File: ${abs}`)
  console.log(`Auditing ${questions.length} questions (start=${start}, batch_size=${batchSize})\n`)

  const client = new Anthropic()
  const allFixes: Array<{ orig: Question; fix: ProposedFix }> = []

  for (let i = 0; i < questions.length; i += batchSize) {
    const batch = questions.slice(i, i + batchSize)
    console.log(`Batch ${Math.floor(i / batchSize) + 1} (${batch.length} questions, abs idx ${start + i}–${start + i + batch.length - 1}):`)
    try {
      const fixes = await auditBatch(client, batch)
      for (let j = 0; j < batch.length; j++) {
        const fix = fixes.find((f) => f.id === batch[j].id)
        if (fix && fix.needs_fix) {
          allFixes.push({ orig: batch[j], fix })
        }
      }
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) {
        console.log("  rate limited — sleeping 30s")
        await new Promise((r) => setTimeout(r, 30_000))
        i -= batchSize // retry batch
      } else if (err instanceof Anthropic.APIError) {
        console.error(`  API error ${err.status}: ${err.message}`)
        throw err
      } else {
        throw err
      }
    }
  }

  console.log(`\n=== Proposed fixes: ${allFixes.length} / ${questions.length} ===\n`)
  for (const { orig, fix } of allFixes) {
    console.log(`[${orig.id}] ${fix.reason ?? ""}`)
    const d = diff(orig, fix)
    if (d) console.log(d)
    console.log()
  }

  if (apply && allFixes.length > 0) {
    const fixById = new Map(allFixes.map((f) => [f.orig.id, f.fix]))
    const updatedQuestions = seed.questions.map((q) => {
      const fix = fixById.get(q.id)
      return fix ? applyFix(q, fix) : q
    })
    fs.writeFileSync(
      abs,
      JSON.stringify({ ...seed, questions: updatedQuestions }, null, 2) + "\n",
      "utf8",
    )
    console.log(`Wrote ${allFixes.length} fixes to ${abs}.`)
  } else if (!apply) {
    console.log("(Dry run — re-run with --apply to write.)")
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
