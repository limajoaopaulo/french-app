import Link from "next/link"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { RadarChart } from "@/components/stats/RadarChart"
import { PatternBreakdown, type PatternRow } from "@/components/stats/PatternBreakdown"
import { ProgressBar } from "@/components/ui/ProgressBar"
import { getDomains, type Domain } from "@/lib/taxonomy"
import { DIFFICULTIES } from "@/lib/constants"
import {
  loadSubAggregates,
  loadSubReviewCounts,
} from "@/lib/progression"
import {
  bandProgressToNext,
  cardsToNextLevel,
  cefrLabel,
  patternMastery,
  type CardForLevel,
} from "@/lib/levels"
import { LEVEL_LABELS } from "@/lib/constants"
import { t } from "@/lib/i18n"
import { getCurrentUser } from "@/lib/auth"

export const dynamic = "force-dynamic"

export default async function StatsPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/welcome")
  const now = new Date()
  const [subAggregates, statesWithQuestion, patternStats, reviewCounts] =
    await Promise.all([
      loadSubAggregates(user.id, user.languageId),
      prisma.questionState.findMany({
        where: { userId: user.id, question: { languageId: user.languageId } },
        include: {
          question: { select: { domain: true, sub: true, pattern: true, level: true } },
        },
      }),
      prisma.patternStats.findMany({ where: { userId: user.id } }),
      loadSubReviewCounts(user.id, user.languageId),
    ])
  const DOMAINS = getDomains(user.languageCode)

  const cardsForPattern: Array<CardForLevel & { pattern: string }> =
    statesWithQuestion.map((s) => ({
      level: s.question.level,
      stability: s.stability,
      difficulty: s.difficulty,
      state: s.state,
      scheduledDays: s.scheduledDays,
      learningSteps: s.learningSteps,
      reps: s.reps,
      lapses: s.lapses,
      lastReview: s.lastReview,
      dueAt: s.dueAt,
      pattern: s.question.pattern,
    }))
  const masteryRows = patternMastery(cardsForPattern, now)
  const masteryByPattern = new Map(masteryRows.map((m) => [m.pattern, m]))

  const recurringMisses = masteryRows
    .filter(
      (m) =>
        m.cardCount >= DIFFICULTIES.homeCardMinCards &&
        m.meanR < DIFFICULTIES.homeCardMeanR,
    )
    .sort((a, b) => a.meanR - b.meanR)
    .slice(0, 12)

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

        {recurringMisses.length > 0 && (
          <section className="flex flex-col gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6">
            <div>
              <h2 className="text-lg font-semibold">
                {t.stats.difficultiesTitle}
              </h2>
              <p className="text-sm text-zinc-400">
                {t.stats.difficultiesSubtitle(recurringMisses.length)}
              </p>
            </div>
            <ul className="flex flex-col gap-1.5 text-sm text-zinc-300">
              {recurringMisses.map((p) => (
                <li
                  key={p.pattern}
                  className="flex items-center justify-between rounded-md bg-white/5 px-3 py-1.5"
                >
                  <span className="font-mono text-xs">{p.pattern}</span>
                  <span className="text-xs text-rose-300">
                    R={(p.meanR * 100).toFixed(0)}% · {p.cardCount} cartes
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(Object.keys(DOMAINS) as Domain[]).map((domainKey) => {
          const info = DOMAINS[domainKey]
          const axes = info.subs.map((s) => {
            const row = subAggregates.find(
              (x) => x.domain === domainKey && x.sub === s.key,
            )
            return {
              label: s.shortLabel,
              value: row?.subLevel ?? 0,
            }
          })

          return (
            <section
              key={domainKey}
              className="flex flex-col gap-6 rounded-2xl border border-white/10 bg-zinc-900/60 p-6"
            >
              <RadarChart
                title={info.label}
                axes={axes}
                stroke={info.color}
                fill={info.color}
              />
              <div className="flex flex-col gap-3">
                {info.subs.map((s) => {
                  const patterns: PatternRow[] = s.patterns.map((pat) => {
                    const ps = patternStats.find(
                      (x) =>
                        x.domain === domainKey && x.sub === s.key && x.pattern === pat,
                    )
                    const m = masteryByPattern.get(pat)
                    return {
                      pattern: pat,
                      meanR: m?.meanR ?? 0,
                      meanStability: m?.meanStability ?? 0,
                      cardCount: m?.cardCount ?? 0,
                      lastSeenAt: ps?.lastSeenAt ?? null,
                    }
                  })
                  const sub = subAggregates.find(
                    (x) => x.domain === domainKey && x.sub === s.key,
                  )
                  const subCards = statesWithQuestion
                    .filter(
                      (st) =>
                        st.question.domain === domainKey &&
                        st.question.sub === s.key,
                    )
                    .map((st) => ({
                      level: st.question.level,
                      stability: st.stability,
                    }))
                  const subLevelValue = sub?.subLevel ?? 0
                  const band = bandProgressToNext(subCards, subLevelValue)
                  const nextLevelInfo = cardsToNextLevel(
                    subCards,
                    subLevelValue,
                  )
                  const counts = reviewCounts.get(`${domainKey}::${s.key}`)
                  const hasAnswered = (counts?.total ?? 0) > 0
                  const accuracyPct = hasAnswered
                    ? Math.round((counts!.correct / counts!.total) * 100)
                    : 0
                  const cefr = cefrLabel(subLevelValue)
                  const bandRatio = band.progress
                  let progressLabel: string
                  if (band.nextLevel === null) {
                    progressLabel = t.stats.maxLevelReached
                  } else if (nextLevelInfo && nextLevelInfo.needed === 0) {
                    progressLabel = t.stats.readyToLevelUp
                  } else {
                    const nextLabel =
                      t.levels[LEVEL_LABELS[band.nextLevel]] ??
                      LEVEL_LABELS[band.nextLevel] ??
                      String(band.nextLevel)
                    progressLabel = t.end.progressToNext(
                      Math.round(band.progress * 100),
                      nextLabel,
                    )
                  }

                  return (
                    <details
                      key={s.key}
                      className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2"
                    >
                      <summary className="flex cursor-pointer flex-col gap-1.5 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-zinc-200">{s.label}</span>
                          <span className="flex items-center gap-2 text-xs">
                            <span
                              className="rounded-full border border-white/10 px-2 py-0.5 font-mono uppercase tracking-wide text-zinc-200"
                              style={{ borderColor: info.color, color: info.color }}
                            >
                              {cefr}
                            </span>
                            <span className="text-emerald-300/80">
                              {progressLabel}
                            </span>
                          </span>
                        </div>
                        <ProgressBar ratio={bandRatio} color={info.color} />
                        <div className="flex items-center justify-between gap-3 text-[11px] text-zinc-500">
                          {hasAnswered ? (
                            <>
                              <span>{t.stats.totalAnswered(counts!.total)}</span>
                              <span>{t.stats.accuracyPct(accuracyPct)}</span>
                            </>
                          ) : (
                            <span>{t.stats.notAnsweredYet}</span>
                          )}
                        </div>
                      </summary>
                      <PatternBreakdown patterns={patterns} />
                    </details>
                  )
                })}
              </div>
            </section>
          )
        })}

        {subAggregates.length === 0 && patternStats.length === 0 && (
          <p className="text-center text-sm text-zinc-500">{t.stats.noStats}</p>
        )}
      </div>
    </main>
  )
}
