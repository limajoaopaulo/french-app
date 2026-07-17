import "dotenv/config"
import { readFileSync, writeFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"

// Merge src/data/fr/batches/*.json into a fresh src/data/fr/seed.json (reauthor
// fresh — old FR content is discarded), dedup by id, then rebuild the FR bank in
// the DB (delete old FR questions + their reviews/states/tags, reseed via seed.ts
// separately). PT is untouched.

interface Q {
  id: string
  [k: string]: unknown
}

async function main() {
  const batchDir = "src/data/fr/batches"
  const files = readdirSync(resolve(batchDir)).filter((f) => f.endsWith(".json"))
  const byId = new Map<string, Q>()
  let dupes = 0
  for (const f of files) {
    const parsed = JSON.parse(readFileSync(resolve(batchDir, f), "utf8")) as {
      questions: Q[]
    }
    for (const q of parsed.questions) {
      if (byId.has(q.id)) {
        dupes++
        continue
      }
      byId.set(q.id, q)
    }
    console.log(`  ${f}: ${parsed.questions.length}`)
  }
  const questions = [...byId.values()]
  writeFileSync(
    resolve("src/data/fr/seed.json"),
    JSON.stringify({ questions }, null, 2) + "\n",
    "utf8",
  )
  console.log(`\nMerged ${questions.length} FR questions (${dupes} dup ids skipped) → src/data/fr/seed.json`)

  // Purge the old FR bank from the DB so reseed is clean.
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL not set")
  const adapter = new PrismaBetterSqlite3({ url })
  const prisma = new PrismaClient({ adapter })
  try {
    const fr = await prisma.language.findUnique({ where: { code: "fr" } })
    if (fr) {
      const frQ = await prisma.question.findMany({
        where: { languageId: fr.id },
        select: { id: true },
      })
      const ids = frQ.map((q) => q.id)
      const chunks: number[][] = []
      for (let i = 0; i < ids.length; i += 400) chunks.push(ids.slice(i, i + 400))
      for (const c of chunks) {
        await prisma.review.deleteMany({ where: { questionId: { in: c } } })
        await prisma.questionState.deleteMany({ where: { questionId: { in: c } } })
        await prisma.questionTag.deleteMany({ where: { questionId: { in: c } } })
        await prisma.question.deleteMany({ where: { id: { in: c } } })
      }
      console.log(`Purged ${ids.length} old FR questions from DB. Now run: npm run seed`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
