import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")
  const adapter = new PrismaBetterSqlite3({ url })
  const prisma = new PrismaClient({ adapter })

  try {
    const reviews = await prisma.review.deleteMany()
    const states = await prisma.questionState.deleteMany()
    const patternStats = await prisma.patternStats.deleteMany()
    const sessions = await prisma.session.deleteMany()
    const subStats = await prisma.subStats.deleteMany()
    const users = await prisma.user.deleteMany()
    const questions = await prisma.question.deleteMany()
    const languages = await prisma.language.deleteMany()

    console.log(`Review:        ${reviews.count}`)
    console.log(`QuestionState: ${states.count}`)
    console.log(`PatternStats:  ${patternStats.count}`)
    console.log(`Session:       ${sessions.count}`)
    console.log(`SubStats:      ${subStats.count}`)
    console.log(`User:          ${users.count}`)
    console.log(`Question:      ${questions.count}`)
    console.log(`Language:      ${languages.count}`)
    console.log("Reset complete.")
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
