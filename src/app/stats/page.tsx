import Link from "next/link"
import { redirect } from "next/navigation"
import { RadarChart } from "@/components/stats/RadarChart"
import {
  loadTagAggregates,
  loadTagReviewCounts,
} from "@/lib/progression"
import { getFacets, FACETS, tagShortLabel } from "@/lib/taxonomy"
import { cefrLabel, tagKey } from "@/lib/levels"
import { t } from "@/lib/i18n"
import { getCurrentUser } from "@/lib/auth"

export const dynamic = "force-dynamic"

export default async function StatsPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/welcome")

  const [aggregates, reviewCounts] = await Promise.all([
    loadTagAggregates(user.id, user.languageId, user.languageCode),
    loadTagReviewCounts(user.id, user.languageId),
  ])

  const facets = getFacets(user.languageCode)
  const hasAnyData = aggregates.some((a) => a.total > 0)

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-12 text-zinc-100">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{t.stats.title}</h1>
            <p className="text-xs text-zinc-500">{t.stats.legendLevel}</p>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-white/5"
          >
            {t.stats.backHome}
          </Link>
        </header>

        {FACETS.map((facet) => {
          const info = facets[facet]
          const rows = aggregates.filter((a) => a.facet === facet)

          const axes = rows.map((row) => ({
            label: tagShortLabel(user.languageCode, facet, row.tag),
            value: row.tagLevel,
          }))

          return (
            <section
              key={facet}
              className="flex flex-col gap-6 rounded-2xl border border-white/10 bg-zinc-900/60 p-6"
            >
              <RadarChart
                title={info.label}
                axes={axes}
                stroke={info.color}
                fill={info.color}
              />
              <div className="flex flex-col gap-2">
                {rows.map((row) => {
                  const counts = reviewCounts.get(tagKey(facet, row.tag))
                  const total = counts?.total ?? 0
                  const hasAnswered = total > 0
                  const accuracyPct = hasAnswered
                    ? Math.round((counts!.correct / total) * 100)
                    : 0
                  return (
                    <div
                      key={row.tag}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2.5 text-sm"
                    >
                      <span className="text-zinc-200">{row.label}</span>
                      <span className="flex items-center gap-2 text-xs">
                        <span
                          className="rounded-full border border-white/10 px-2 py-0.5 font-mono uppercase tracking-wide"
                          style={{ borderColor: info.color, color: info.color }}
                        >
                          {cefrLabel(row.tagLevel)}
                        </span>
                        <span className="text-zinc-500">
                          {t.stats.levelLabel(row.tagLevel)}
                        </span>
                        {hasAnswered ? (
                          <span className="text-emerald-300/80">
                            {t.stats.accuracyPct(accuracyPct)}
                          </span>
                        ) : (
                          <span className="text-zinc-500">
                            {t.stats.notAnsweredYet}
                          </span>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}

        {!hasAnyData && (
          <p className="text-center text-sm text-zinc-500">{t.stats.noStats}</p>
        )}
      </div>
    </main>
  )
}
