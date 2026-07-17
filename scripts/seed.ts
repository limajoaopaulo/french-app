import "dotenv/config"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"

interface TagRef {
  facet: "grammar" | "topic"
  tag: string
  role: "focus" | "context"
}

// New tag-format question (FR reauthored). Legacy fields are optional so the
// same loader still ingests the untouched PT bank.
interface SeedQuestion {
  id: string
  level: number
  cue: string
  options: string[]
  correct_index: number
  explanation: string
  register?: string
  // new format
  format?: string
  blankHint?: string
  translation?: string
  tags?: TagRef[]
  // legacy format (derived into tags below)
  domain?: string
  sub?: string
  cue_type?: string
}

const LANGUAGES: Array<{ code: string; name: string }> = [
  { code: "fr", name: "Français" },
  { code: "pt", name: "Português" },
]

// Derive tags from a legacy question: its single (domain, sub) → one focus tag.
function tagsFor(q: SeedQuestion): TagRef[] {
  if (q.tags && q.tags.length > 0) return q.tags
  if (q.domain && q.sub) {
    const facet = q.domain === "grammar" ? "grammar" : "topic"
    return [{ facet, tag: q.sub, role: "focus" }]
  }
  return []
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")
  const adapter = new PrismaBetterSqlite3({ url })
  const prisma = new PrismaClient({ adapter })

  try {
    let inserted = 0
    let updated = 0
    let tagRows = 0

    for (const lang of LANGUAGES) {
      const langRow = await prisma.language.upsert({
        where: { code: lang.code },
        update: { name: lang.name },
        create: { code: lang.code, name: lang.name },
      })

      const seed = readJson<{ questions: SeedQuestion[] }>(
        `src/data/${lang.code}/seed.json`,
      )

      for (const q of seed.questions) {
        const externalId = `${lang.code}:${q.id}`
        const tags = tagsFor(q)
        const data = {
          externalId,
          languageId: langRow.id,
          level: q.level,
          format: q.format ?? q.cue_type ?? "cloze",
          cue: q.cue,
          blankHint: q.blankHint ?? null,
          translation: q.translation ?? null,
          options: JSON.stringify(q.options),
          correctIndex: q.correct_index,
          explanation: q.explanation,
          register: q.register ?? null,
          source: "seed",
        }

        const existing = await prisma.question.findUnique({
          where: { externalId },
          select: { id: true },
        })

        let questionId: number
        if (existing) {
          await prisma.question.update({ where: { id: existing.id }, data })
          questionId = existing.id
          updated++
        } else {
          const created = await prisma.question.create({ data, select: { id: true } })
          questionId = created.id
          inserted++
        }

        // Idempotent tag refresh: drop + recreate this question's tags.
        await prisma.questionTag.deleteMany({ where: { questionId } })
        if (tags.length > 0) {
          await prisma.questionTag.createMany({
            data: tags.map((t) => ({ questionId, facet: t.facet, tag: t.tag, role: t.role })),
          })
          tagRows += tags.length
        }
      }

      console.log(`[${lang.code}] ${seed.questions.length} questions processed`)
    }

    const total = await prisma.question.count()
    console.log(
      `Questions: ${total} total (${inserted} new, ${updated} updated); tag rows written: ${tagRows}`,
    )
    console.log("Seed complete.")
  } finally {
    await prisma.$disconnect()
  }
}

function readJson<T>(p: string): T {
  return JSON.parse(readFileSync(resolve(p), "utf8")) as T
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
