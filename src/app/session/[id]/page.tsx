import { notFound, redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { serveNext } from "@/app/actions/session"
import { SessionRunner } from "./SessionRunner"
import { tagLabel, type Facet, type LanguageCode } from "@/lib/taxonomy"
import { LEVEL_LABELS } from "@/lib/constants"
import { getCurrentUser } from "@/lib/auth"

interface PageProps {
  params: Promise<{ id: string }>
}

function buildFocusHeader(
  session: {
    mode: string
    targetTags: string | null
    levelMin: number | null
    levelMax: number | null
  },
  language: LanguageCode,
): string | null {
  if (!session.targetTags) return null
  let parsed: Array<{ facet: Facet; tag: string }> = []
  try {
    parsed = JSON.parse(session.targetTags)
  } catch {
    return null
  }
  const labels = parsed.map((t) => tagLabel(language, t.facet, t.tag))
  const tagsStr = labels.join(" + ")
  if (session.levelMin === null || session.levelMax === null) return tagsStr
  const rangeStr = `${LEVEL_LABELS[session.levelMin] ?? session.levelMin}–${
    LEVEL_LABELS[session.levelMax] ?? session.levelMax
  }`
  return `${tagsStr} · ${rangeStr}`
}

export default async function SessionPage({ params }: PageProps) {
  const user = await getCurrentUser()
  if (!user) redirect("/welcome")
  const { id } = await params
  const sessionId = Number(id)
  if (!Number.isFinite(sessionId)) notFound()

  const session = await prisma.session.findFirst({
    where: { id: sessionId, userId: user.id },
  })
  if (!session) notFound()

  const first = await serveNext(sessionId)
  const firstQuestion = "done" in first ? null : first
  const focusHeader = buildFocusHeader(session, user.languageCode)

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
      <SessionRunner
        sessionId={sessionId}
        firstQuestion={firstQuestion}
        focusHeader={focusHeader}
      />
    </main>
  )
}
