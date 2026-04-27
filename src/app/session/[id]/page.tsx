import { notFound, redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { serveNext } from "@/app/actions/session"
import { SessionRunner } from "./SessionRunner"
import { getDomains, type Domain, type DomainsByKey } from "@/lib/taxonomy"
import { LEVEL_LABELS } from "@/lib/constants"
import { getCurrentUser } from "@/lib/auth"

interface PageProps {
  params: Promise<{ id: string }>
}

function buildFocusHeader(
  session: {
    mode: string
    targetSubs: string | null
    levelMin: number | null
    levelMax: number | null
    bossDomain: string | null
    bossLevel: number | null
  },
  domains: DomainsByKey,
): string | null {
  if (session.mode === "boss" && session.bossDomain && session.bossLevel !== null) {
    const d = domains[session.bossDomain as Domain]
    const domainLabel = d?.label ?? session.bossDomain
    const levelLabel = LEVEL_LABELS[session.bossLevel] ?? `L${session.bossLevel}`
    return `Boss · ${domainLabel} · ${levelLabel}`
  }
  if (!session.targetSubs) return null
  let parsed: Array<{ domain: string; sub: string }> = []
  try {
    parsed = JSON.parse(session.targetSubs)
  } catch {
    return null
  }
  const subLabels = parsed.map((t) => {
    const d = domains[t.domain as Domain]
    const meta = d?.subs.find((x) => x.key === t.sub)
    return meta?.label ?? t.sub
  })
  const subsStr = subLabels.join(" + ")
  if (session.levelMin === null || session.levelMax === null) return subsStr
  const rangeStr = `${LEVEL_LABELS[session.levelMin] ?? session.levelMin}–${
    LEVEL_LABELS[session.levelMax] ?? session.levelMax
  }`
  return `${subsStr} · ${rangeStr}`
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
  const focusHeader = buildFocusHeader(session, getDomains(user.languageCode))

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
