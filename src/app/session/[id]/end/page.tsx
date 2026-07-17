import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { RankBadge } from "@/components/badges/RankBadge"
import { RadarChart } from "@/components/stats/RadarChart"
import { ProgressBar } from "@/components/ui/ProgressBar"
import { DIFFICULTIES, LEVEL_LABELS } from "@/lib/constants"
import { t } from "@/lib/i18n"
import {
  loadTagAggregates,
  snapshotTagLevels,
  type TagAggregate,
  type TagLevelSnapshot,
} from "@/lib/progression"
import { cefrLabel, tagKey } from "@/lib/levels"
import {
  FACETS,
  getFacets,
  tagLabel,
  tagShortLabel,
  type Facet,
  type FacetInfo,
  type LanguageCode,
} from "@/lib/taxonomy"
import { getCurrentUser } from "@/lib/auth"

interface PageProps {
  params: Promise<{ id: string }>
}

interface TagBreakdownRow {
  facet: Facet
  tag: string
  label: string
  total: number
  correct: number
}

interface ReviewWithTags {
  correct: boolean
  question: { tags: Array<{ facet: string; tag: string; role: string }> }
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

  const reviews = await prisma.review.findMany({
    where: { sessionId, userId: user.id },
    include: {
      question: { select: { tags: { select: { facet: true, tag: true, role: true } } } },
    },
    orderBy: { reviewedAt: "asc" },
  })

  const tagRows = aggregateTagRows(reviews, user.languageCode)

  // Per-session difficulty callout: focus tags missed 2+ times this session.
  const calloutTags = tagRows
    .filter((r) => r.total - r.correct >= 2)
    .sort((a, b) => (b.total - b.correct) - (a.total - a.correct))
    .slice(0, DIFFICULTIES.sessionCalloutTopK)

  // Current per-tag levels, used for the radar(s).
  const aggregates = await loadTagAggregates(
    user.id,
    user.languageId,
    user.languageCode,
  )
  const aggByKey = new Map<string, TagAggregate>(
    aggregates.map((a) => [tagKey(a.facet, a.tag), a]),
  )
  const hasAnyLevel = aggregates.some((a) => a.tagLevel > 0)
  const facets = getFacets(user.languageCode)

  // Advancement: compare the pre-session snapshot with the current levels,
  // keyed by focus tag actually practiced this session.
  const advancementRows =
    tagRows.length > 0 && session.subLevelsBefore
      ? buildAdvancementRows(
          tagRows,
          parseSnapshot(session.subLevelsBefore),
          await snapshotTagLevels(user.id, user.languageId, user.languageCode),
        )
      : []

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-16 text-zinc-100">
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 rounded-2xl border border-white/10 bg-zinc-900/60 p-8">
        <h1 className="text-2xl font-semibold">{t.end.title}</h1>

        <RankBadge ppq={session.ppq} />

        <dl className="grid w-full grid-cols-3 gap-4 pt-2 text-center">
          <Stat label={t.end.points} value={session.totalPoints.toFixed(2)} />
          <Stat label={t.end.ppq} value={session.ppq.toFixed(2)} />
          <Stat
            label="Correct"
            value={`${session.correctCount} / ${session.questionsSeen}`}
          />
        </dl>

        <SessionBreakdown tags={tagRows} />

        {advancementRows.length > 0 && <AdvancementBlock rows={advancementRows} />}

        {hasAnyLevel && (
          <div className="flex w-full flex-col items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              {t.end.radarCaption}
            </p>
            <div className="flex flex-wrap items-start justify-center gap-4">
              {FACETS.map((f) => (
                <FacetRadar
                  key={f}
                  info={facets[f]}
                  aggByKey={aggByKey}
                  languageCode={user.languageCode}
                />
              ))}
            </div>
          </div>
        )}

        {calloutTags.length > 0 && (
          <div className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide">
              Difficultés
            </p>
            <ul className="space-y-1 text-sm">
              {calloutTags.map((m) => (
                <li key={`${m.facet}::${m.tag}`}>
                  Tu as trébuché {m.total - m.correct} fois sur{" "}
                  <span className="font-medium">{m.label}</span>
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

function SessionBreakdown({ tags }: { tags: TagBreakdownRow[] }) {
  if (tags.length === 0) {
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
          {tags.map((row) => (
            <li key={`${row.facet}::${row.tag}`} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-200">{row.label}</span>
                <span className="text-xs text-zinc-400">
                  {row.correct}/{row.total} ·{" "}
                  {Math.round((row.correct / row.total) * 100)}%
                </span>
              </div>
              <ProgressBar ratio={row.total > 0 ? row.correct / row.total : 0} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

interface AdvancementRow {
  facet: Facet
  tag: string
  label: string
  beforeCefr: string
  afterCefr: string
  // Continuous percentage progress toward the next CEFR band.
  beforeProgress: number // 0..1
  afterProgress: number // 0..1
  afterNextLabel: string | null
  state: "leveled_up" | "leveled_down" | "advanced" | "unchanged" | "mastered"
}

function parseSnapshot(json: string): TagLevelSnapshot {
  try {
    return JSON.parse(json) as TagLevelSnapshot
  } catch {
    return {}
  }
}

function buildAdvancementRows(
  drilledTags: TagBreakdownRow[],
  before: TagLevelSnapshot,
  after: TagLevelSnapshot,
): AdvancementRow[] {
  const out: AdvancementRow[] = []
  for (const row of drilledTags) {
    const key = tagKey(row.facet, row.tag)
    const b = before[key]
    const a = after[key]
    if (!b || !a) continue

    const beforeCefr = cefrLabel(b.tagLevel)
    const afterCefr = cefrLabel(a.tagLevel)
    const beforeFloor = Math.floor(b.tagLevel)
    const afterFloor = Math.floor(a.tagLevel)

    let state: AdvancementRow["state"]
    if (afterFloor > beforeFloor) {
      state = afterFloor >= 5 ? "mastered" : "leveled_up"
    } else if (afterFloor < beforeFloor) {
      state = "leveled_down"
    } else if (a.nextLevel === null) {
      state = "mastered"
    } else {
      // Same band: report movement on the continuous progress metric.
      state =
        a.bandProgress > b.bandProgress + 1e-4 ? "advanced" : "unchanged"
    }

    out.push({
      facet: row.facet,
      tag: row.tag,
      label: row.label,
      beforeCefr,
      afterCefr,
      beforeProgress: b.bandProgress,
      afterProgress: a.bandProgress,
      afterNextLabel: a.nextLevel
        ? t.levels[LEVEL_LABELS[a.nextLevel] ?? ""] ??
          LEVEL_LABELS[a.nextLevel] ??
          ""
        : null,
      state,
    })
  }
  return out
}

function AdvancementBlock({ rows }: { rows: AdvancementRow[] }) {
  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
        {t.end.advancementHeading}
      </h2>
      <ul className="flex flex-col gap-3">
        {rows.map((r) => {
          const beforePct = Math.round(r.beforeProgress * 100)
          const afterPct = Math.round(r.afterProgress * 100)
          const deltaPct = afterPct - beforePct
          return (
            <li key={`${r.facet}::${r.tag}`} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-zinc-200">{r.label}</span>
                <AdvancementBadge row={r} />
              </div>
              <ProgressBar ratio={r.afterProgress} />
              <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-400">
                <span>
                  {r.afterNextLabel === null
                    ? t.end.mastered
                    : beforePct === afterPct
                      ? t.end.progressToNext(afterPct, r.afterNextLabel)
                      : t.end.progressBeforeAfter(
                          beforePct,
                          afterPct,
                          r.afterNextLabel,
                        )}
                </span>
                {deltaPct > 0 && (
                  <span className="text-emerald-300">
                    {t.end.progressDelta(deltaPct)}
                  </span>
                )}
                {deltaPct < 0 && (
                  <span className="text-rose-300">
                    {t.end.progressDelta(deltaPct)}
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function AdvancementBadge({ row }: { row: AdvancementRow }) {
  const base =
    "rounded-full border px-2 py-0.5 text-[11px] font-mono uppercase tracking-wide"
  if (row.state === "leveled_up") {
    return (
      <span
        className={`${base} border-emerald-400/50 bg-emerald-500/10 text-emerald-200`}
      >
        {t.end.leveledUp(row.beforeCefr, row.afterCefr)}
      </span>
    )
  }
  if (row.state === "leveled_down") {
    return (
      <span
        className={`${base} border-rose-400/50 bg-rose-500/10 text-rose-200`}
      >
        {t.end.leveledDown(row.beforeCefr, row.afterCefr)}
      </span>
    )
  }
  if (row.state === "mastered") {
    return (
      <span
        className={`${base} border-amber-400/50 bg-amber-500/10 text-amber-200`}
      >
        {row.afterCefr}
      </span>
    )
  }
  return (
    <span className={`${base} border-white/10 bg-white/5 text-zinc-200`}>
      {row.afterCefr}
    </span>
  )
}

function FacetRadar({
  info,
  aggByKey,
  languageCode,
}: {
  info: FacetInfo
  aggByKey: Map<string, TagAggregate>
  languageCode: LanguageCode
}) {
  if (info.tags.length === 0) return null
  const axes = info.tags.map((tg) => ({
    label: tagShortLabel(languageCode, info.key, tg.key),
    value: aggByKey.get(tagKey(info.key, tg.key))?.tagLevel ?? 0,
  }))
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

function aggregateTagRows(
  reviews: ReviewWithTags[],
  languageCode: LanguageCode,
): TagBreakdownRow[] {
  const map = new Map<string, TagBreakdownRow>()
  for (const r of reviews) {
    for (const tg of r.question.tags) {
      if (tg.role !== "focus") continue
      if (tg.facet !== "grammar" && tg.facet !== "topic") continue
      const facet = tg.facet as Facet
      const key = tagKey(facet, tg.tag)
      const existing = map.get(key)
      if (existing) {
        existing.total += 1
        if (r.correct) existing.correct += 1
        continue
      }
      map.set(key, {
        facet,
        tag: tg.tag,
        label: tagLabel(languageCode, facet, tg.tag),
        total: 1,
        correct: r.correct ? 1 : 0,
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs uppercase tracking-wider text-zinc-400">{label}</dt>
      <dd className="text-lg font-semibold text-zinc-100">{value}</dd>
    </div>
  )
}
