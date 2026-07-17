import Link from "next/link"
import { redirect } from "next/navigation"
import { HomeStart } from "./HomeStart"
import { t } from "@/lib/i18n"
import { loadHomeData, type RecentSession, type RecurrentDifficulty } from "@/lib/home"
import { cefrLabel } from "@/lib/levels"
import { ProgressBar } from "@/components/ui/ProgressBar"
import { UserTierBadge } from "@/components/badges/UserTierBadge"
import { getCurrentUser } from "@/lib/auth"

export const dynamic = "force-dynamic"

export default async function Home() {
  const user = await getCurrentUser()
  if (!user) redirect("/welcome")
  const data = await loadHomeData({
    userId: user.id,
    languageId: user.languageId,
    languageCode: user.languageCode,
  })

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-16 text-zinc-100">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <header className="flex flex-col gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{t.appTitle}</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Single-user personal trainer — entraîne-toi, progresse.
            </p>
          </div>
          <UserTierBadge xp={data.lifetimeXp} tier={data.tier} />
        </header>

        <Card>
          <div>
            <h2 className="text-xl font-semibold">
              {t.home.personalisedHeadline}
            </h2>
            <p className="text-sm text-zinc-400">
              {t.home.personalisedSubtitle}
            </p>
          </div>
          <HomeStart
            preview={data.personalisedPreview}
            defaultLength={user.defaultDrillLength}
          />
        </Card>

        <Card>
          <SectionHeader
            title={t.home.progressionTitle}
            subtitle={t.home.progressionCaption(
              `${cefrLabel(data.overallLevel)} (${data.overallLevel.toFixed(2)})`,
            )}
          />
          <ProgressBar ratio={Math.max(0, Math.min(1, data.overallLevel / 5))} />
          <div className="flex justify-between text-[11px] text-zinc-500">
            <span>A1</span>
            <span>A2</span>
            <span>B1</span>
            <span>B2</span>
            <span>C1</span>
          </div>
        </Card>

        {data.dueReviewCount > 0 && (
          <Card>
            <SectionHeader
              title={t.home.revisionTitle}
              subtitle={t.home.revisionSubtitle(data.dueReviewCount)}
            />
            <span className="self-start rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400">
              {t.home.revisionSoon}
            </span>
          </Card>
        )}

        {data.recurrentDifficulties.length > 0 && (
          <Card>
            <SectionHeader
              title={t.home.toImproveTitle}
              subtitle={t.home.toImproveSubtitle(data.recurrentDifficulties.length)}
            />
            <ul className="flex flex-wrap gap-2">
              {data.recurrentDifficulties.slice(0, 6).map((d) => (
                <DifficultyChip key={`${d.facet}-${d.tag}`} d={d} />
              ))}
            </ul>
          </Card>
        )}

        <Card>
          <SectionHeader title={t.home.recentTitle} />
          {data.recentSessions.length === 0 ? (
            <p className="text-sm text-zinc-500">{t.home.recentEmpty}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {data.recentSessions.map((s) => (
                <RecentRow key={s.id} s={s} />
              ))}
            </ul>
          )}
        </Card>

        <nav className="flex gap-3 text-sm">
          <Link
            href="/stats"
            className="rounded-lg border border-white/10 px-3 py-1.5 text-zinc-300 transition hover:bg-white/5"
          >
            {t.home.statsLink}
          </Link>
          <Link
            href="/settings"
            className="rounded-lg border border-white/10 px-3 py-1.5 text-zinc-300 transition hover:bg-white/5"
          >
            {t.home.settingsLink}
          </Link>
        </nav>
      </div>
    </main>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-zinc-900/60 p-6 shadow-lg">
      {children}
    </section>
  )
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {subtitle && <p className="text-sm text-zinc-400">{subtitle}</p>}
    </div>
  )
}

function DifficultyChip({ d }: { d: RecurrentDifficulty }) {
  return (
    <li className="flex items-center gap-2 rounded-md border border-rose-400/25 bg-rose-500/10 px-2.5 py-1 text-xs text-rose-100">
      <span>{d.label}</span>
      <span className="text-[10px] text-rose-200/70">
        {Math.round(d.meanR * 100)}%
      </span>
    </li>
  )
}

function RecentRow({ s }: { s: RecentSession }) {
  const accuracy = s.questionsSeen > 0
    ? Math.round((s.correctCount / s.questionsSeen) * 100)
    : 0
  return (
    <li className="flex items-center justify-between rounded-md bg-white/5 px-3 py-1.5 text-sm">
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-zinc-200">Entraînement</span>
        <span className="text-[11px] text-zinc-500">
          {s.questionsSeen} Q · {accuracy}% · {s.ppq.toFixed(2)} ppq
        </span>
      </div>
      <span
        className="rounded-full px-2 py-0.5 text-[11px] font-medium"
        style={{ backgroundColor: `${s.rankTier.color}22`, color: s.rankTier.color }}
      >
        {t.ranks[s.rankTier.name] ?? s.rankTier.name}
      </span>
    </li>
  )
}
