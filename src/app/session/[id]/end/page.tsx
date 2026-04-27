import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { RankBadge } from "@/components/badges/RankBadge"
import { RadarChart } from "@/components/stats/RadarChart"
import { DIFFICULTIES, LEVEL_LABELS } from "@/lib/constants"
import { t } from "@/lib/i18n"
import { bossMedalFromMisses } from "@/lib/boss"
import { loadBossDefeatDetails } from "@/app/actions/session"
import { loadSubAggregates } from "@/lib/progression"
import { getDomains, type Domain, type DomainsByKey } from "@/lib/taxonomy"
import { getCurrentUser } from "@/lib/auth"

interface PageProps {
  params: Promise<{ id: string }>
}

interface SubBreakdownRow {
  domain: Domain
  sub: string
  label: string
  total: number
  correct: number
}

interface PatternBreakdownRow {
  pattern: string
  total: number
  correct: number
}

export default async function SessionEndPage({ params }: PageProps) {
  const user = await getCurrentUser()
  if (!user) redirect("/welcome")
  const { id } = await params
  const sessionId = Number(id)
  if (!Number.isFinite(sessionId)) notFound()

  const session = await prisma.session.findFirst({
    where: { id: sessionId, userId: user.id },
  })
  if (!session) notFound()
  const DOMAINS = getDomains(user.languageCode)

  const isBoss = session.mode === "boss"
  const isDefeat = isBoss && session.endReason === "boss_defeat"
  const medal =
    isBoss && !isDefeat && session.bossMedal !== null
      ? bossMedalFromMisses(session.missCount)
      : null

  const defeatDetails = isDefeat ? await loadBossDefeatDetails(sessionId) : null

  const reviews = await prisma.review.findMany({
    where: { sessionId, userId: user.id },
    include: {
      question: { select: { domain: true, sub: true, pattern: true } },
    },
    orderBy: { reviewedAt: "asc" },
  })

  // Per-session difficulty callout: top-K patterns with the worst miss rate
  // this session (from review rows, no separate PatternMiss table needed).
  const sessionPatternStats = new Map<string, { total: number; misses: number }>()
  for (const r of reviews) {
    const cur = sessionPatternStats.get(r.question.pattern) ?? { total: 0, misses: 0 }
    cur.total++
    if (!r.correct) cur.misses++
    sessionPatternStats.set(r.question.pattern, cur)
  }
  const calloutPatterns = Array.from(sessionPatternStats.entries())
    .filter(([, v]) => v.misses >= 2)
    .sort((a, b) => b[1].misses - a[1].misses || (b[1].misses / b[1].total) - (a[1].misses / a[1].total))
    .slice(0, DIFFICULTIES.sessionCalloutTopK)
    .map(([pattern, v]) => ({ pattern, missCount: v.misses, total: v.total }))

  const subRows = aggregateSubRows(reviews, DOMAINS)
  const patternRows = aggregatePatternRows(reviews)

  const radarDomains = pickRadarDomains(session)
  const allAggregates =
    radarDomains.length > 0
      ? await loadSubAggregates(user.id, user.languageId)
      : []
  const subStatsForRadar = allAggregates
    .filter((a) => radarDomains.includes(a.domain as Domain))
    .map((a) => ({ domain: a.domain, sub: a.sub, level: a.subLevel }))

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-16 text-zinc-100">
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 rounded-2xl border border-white/10 bg-zinc-900/60 p-8">
        {isDefeat && defeatDetails ? (
          <BossDefeatBanner
            bossLevel={defeatDetails.bossLevel}
            bossDomainLabel={t.domains[defeatDetails.domain]}
            subs={defeatDetails.subs}
          />
        ) : medal ? (
          <BossMedalBanner
            medalLabel={medal.label}
            medalColor={medal.color}
            bossLevel={session.bossLevel ?? 0}
            bossDomainLabel={
              session.bossDomain ? t.domains[session.bossDomain] : ""
            }
          />
        ) : (
          <h1 className="text-2xl font-semibold">{t.end.title}</h1>
        )}

        {!isDefeat && <RankBadge ppq={session.ppq} />}

        <dl className="grid w-full grid-cols-3 gap-4 pt-2 text-center">
          <Stat label={t.end.points} value={session.totalPoints.toFixed(2)} />
          <Stat label={t.end.ppq} value={session.ppq.toFixed(2)} />
          <Stat
            label="Correct"
            value={`${session.correctCount} / ${session.questionsSeen}`}
          />
        </dl>

        <SessionBreakdown subs={subRows} patterns={patternRows} />

        {subStatsForRadar.length > 0 && radarDomains.length > 0 && (
          <div className="flex w-full flex-col items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              {t.end.radarCaption}
            </p>
            <div className="flex flex-wrap items-start justify-center gap-4">
              {radarDomains.map((d) => (
                <MiniRadar
                  key={d}
                  domain={d}
                  domains={DOMAINS}
                  subStats={subStatsForRadar.filter((s) => s.domain === d)}
                />
              ))}
            </div>
          </div>
        )}

        {calloutPatterns.length > 0 && (
          <div className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide">
              Difficultés
            </p>
            <ul className="space-y-1 text-sm">
              {calloutPatterns.map((m) => (
                <li key={m.pattern}>
                  Tu as trébuché {m.missCount} fois sur{" "}
                  <span className="font-mono">{m.pattern}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Link
          href="/"
          className="mt-2 rounded-lg bg-white px-5 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200"
        >
          {t.end.backHome}
        </Link>
      </div>
    </main>
  )
}

function SessionBreakdown({
  subs,
  patterns,
}: {
  subs: SubBreakdownRow[]
  patterns: PatternBreakdownRow[]
}) {
  if (subs.length === 0) {
    return (
      <div className="w-full rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm text-zinc-500">
        {t.end.noReviews}
      </div>
    )
  }
  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
        {t.end.breakdownTitle}
      </h2>
      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] uppercase tracking-wide text-zinc-500">
          {t.end.perSubHeading}
        </p>
        <ul className="flex flex-col gap-1.5">
          {subs.map((row) => (
            <li key={`${row.domain}-${row.sub}`} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-200">{row.label}</span>
                <span className="text-xs text-zinc-400">
                  {row.correct}/{row.total} ·{" "}
                  {Math.round((row.correct / row.total) * 100)}%
                </span>
              </div>
              <AccuracyBar correct={row.correct} total={row.total} />
            </li>
          ))}
        </ul>
      </div>
      {patterns.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-1">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">
            {t.end.patternsAnsweredHeading}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {patterns.map((p) => {
              const all = p.correct === p.total
              const none = p.correct === 0
              const tone = all
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : none
                  ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-200"
              return (
                <li
                  key={p.pattern}
                  className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${tone}`}
                >
                  {p.pattern} {p.correct}/{p.total}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function AccuracyBar({ correct, total }: { correct: number; total: number }) {
  const ratio = total > 0 ? correct / total : 0
  const color =
    ratio < 0.6 ? "#f43f5e" : ratio < 0.8 ? "#f59e0b" : "#10b981"
  return (
    <div className="h-1 overflow-hidden rounded-full bg-white/5">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.round(ratio * 100)}%`, backgroundColor: color }}
      />
    </div>
  )
}

function MiniRadar({
  domain,
  subStats,
  domains,
}: {
  domain: Domain
  subStats: Array<{ sub: string; level: number }>
  domains: DomainsByKey
}) {
  const info = domains[domain]
  if (!info) return null
  const axes = info.subs.map((s) => {
    const row = subStats.find((x) => x.sub === s.key)
    return { label: s.shortLabel, value: row?.level ?? 0 }
  })
  return (
    <RadarChart
      title={info.label}
      axes={axes}
      size={240}
      stroke={info.color}
      fill={info.color}
    />
  )
}

function aggregateSubRows(
  reviews: Array<{
    correct: boolean
    question: { domain: string; sub: string }
  }>,
  domains: DomainsByKey,
): SubBreakdownRow[] {
  const map = new Map<string, SubBreakdownRow>()
  for (const r of reviews) {
    const domain = r.question.domain as Domain
    const info = domains[domain]
    if (!info) continue
    const key = `${domain}::${r.question.sub}`
    const existing = map.get(key)
    if (existing) {
      existing.total += 1
      if (r.correct) existing.correct += 1
      continue
    }
    const label =
      info.subs.find((s) => s.key === r.question.sub)?.label ?? r.question.sub
    map.set(key, {
      domain,
      sub: r.question.sub,
      label,
      total: 1,
      correct: r.correct ? 1 : 0,
    })
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

function aggregatePatternRows(
  reviews: Array<{ correct: boolean; question: { pattern: string } }>,
): PatternBreakdownRow[] {
  const map = new Map<string, PatternBreakdownRow>()
  for (const r of reviews) {
    const existing = map.get(r.question.pattern)
    if (existing) {
      existing.total += 1
      if (r.correct) existing.correct += 1
      continue
    }
    map.set(r.question.pattern, {
      pattern: r.question.pattern,
      total: 1,
      correct: r.correct ? 1 : 0,
    })
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

function pickRadarDomains(session: {
  mode: string
  domainFilter: string | null
  bossDomain: string | null
}): Domain[] {
  const all: Domain[] = ["grammar", "vocabulary"]
  if (session.mode === "boss" && session.bossDomain) {
    return [session.bossDomain as Domain]
  }
  if (session.domainFilter === "grammar" || session.domainFilter === "vocabulary") {
    return [session.domainFilter]
  }
  return all
}

function BossDefeatBanner({
  bossLevel,
  bossDomainLabel,
  subs,
}: {
  bossLevel: number
  bossDomainLabel: string
  subs: Array<{ sub: string; label: string; level: number }>
}) {
  const levelLabel = LEVEL_LABELS[bossLevel] ?? `L${bossLevel}`
  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-5 text-rose-100">
      <h1 className="text-2xl font-semibold text-rose-100">{t.boss.defeatTitle}</h1>
      <p className="text-sm text-rose-200">
        {t.boss.defeatBody(bossDomainLabel, levelLabel)}
      </p>
      {subs.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg bg-rose-950/40 p-3">
          <p className="text-xs uppercase tracking-wide text-rose-300">
            {t.boss.relockedListTitle}
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {subs.map((s) => (
              <li key={s.sub} className="flex items-center justify-between">
                <span>{s.label}</span>
                <span className="font-mono text-xs text-rose-200">
                  {s.level.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function BossMedalBanner({
  medalLabel,
  medalColor,
  bossLevel,
  bossDomainLabel,
}: {
  medalLabel: string
  medalColor: string
  bossLevel: number
  bossDomainLabel: string
}) {
  const levelLabel = LEVEL_LABELS[bossLevel] ?? `L${bossLevel}`
  return (
    <div
      className="flex w-full flex-col items-center gap-2 rounded-xl border p-5"
      style={{
        borderColor: `${medalColor}66`,
        backgroundColor: `${medalColor}1a`,
        color: medalColor,
      }}
    >
      <h1 className="text-2xl font-semibold">{t.boss.medalTitle}</h1>
      <p className="text-sm opacity-90">
        {bossDomainLabel} · {levelLabel}
      </p>
      <p className="text-lg font-semibold">{t.boss.medalEarned(medalLabel)}</p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs uppercase tracking-wider text-zinc-400">{label}</dt>
      <dd className="text-lg font-semibold text-zinc-100">{value}</dd>
    </div>
  )
}
