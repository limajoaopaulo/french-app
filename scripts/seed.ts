import "dotenv/config"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"

interface SeedQuestion {
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

interface Taxonomy {
  domains: Record<
    string,
    {
      label: string
      color: string
      subs: Record<string, { label: string; hint: string; shortLabel?: string; patterns?: string[] }>
    }
  >
  default_active: Record<string, string[]>
}

const LANGUAGES: Array<{ code: string; name: string }> = [
  { code: "fr", name: "Français" },
  { code: "pt", name: "Português" },
]

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")
  const adapter = new PrismaBetterSqlite3({ url })
  const prisma = new PrismaClient({ adapter })

  try {
    let questionsInserted = 0
    let questionsUpdated = 0
    let totalLanguages = 0

    for (const lang of LANGUAGES) {
      // Upsert language row.
      const langRow = await prisma.language.upsert({
        where: { code: lang.code },
        update: { name: lang.name },
        create: { code: lang.code, name: lang.name },
      })
      totalLanguages++

      const taxonomy = readJson<Taxonomy>(`src/data/${lang.code}/taxonomy.json`)
      const seed = readJson<{ questions: SeedQuestion[] }>(
        `src/data/${lang.code}/seed.json`,
      )

      for (const q of seed.questions) {
        const data = {
          externalId: `${lang.code}:${q.id}`,
          languageId: langRow.id,
          domain: q.domain,
          sub: q.sub,
          level: q.level,
          pattern: q.pattern,
          counterpart: q.counterpart ?? null,
          cueType: q.cue_type,
          cue: q.cue,
          options: JSON.stringify(q.options),
          correctIndex: q.correct_index,
          explanation: q.explanation,
          register: q.register ?? null,
          source: "seed",
        } as const

        const existing = await prisma.question.findUnique({
          where: { externalId: data.externalId },
        })
        if (existing) {
          await prisma.question.update({ where: { id: existing.id }, data })
          questionsUpdated++
        } else {
          await prisma.question.create({ data })
          questionsInserted++
        }
      }

      // Validate taxonomy structure (domain/sub/pattern keys exist) — sanity log.
      let subCount = 0
      let patternCount = 0
      for (const [, dv] of Object.entries(taxonomy.domains)) {
        for (const [, sv] of Object.entries(dv.subs)) {
          subCount++
          patternCount += sv.patterns?.length ?? 0
        }
      }
      console.log(
        `[${lang.code}] taxonomy: ${subCount} subs, ${patternCount} patterns`,
      )
    }

    const totalQuestions = await prisma.question.count()
    console.log(`Languages: ${totalLanguages}`)
    console.log(
      `Questions: ${totalQuestions} total (${questionsInserted} new, ${questionsUpdated} updated)`,
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
