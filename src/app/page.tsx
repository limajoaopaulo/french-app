import Link from "next/link"
import { redirect } from "next/navigation"
import { HomeStart } from "./HomeStart"
import { t } from "@/lib/i18n"
import { loadHomeData, type RecentSession, type BossCard } from "@/lib/home"
import { LEVEL_LABELS } from "@/lib/constants"
import { BossTileButton } from "@/components/home/BossTileButton"
import { ProgressBar } from "@/components/ui/ProgressBar"
import { UserTierBadge } from "@/components/badges/UserTierBadge"
import { medalByTier } from "@/lib/boss"
import { getDomains, type Domain, type DomainsByKey } from "@/lib/taxonomy"
import { getCurrentUser } from "@/lib/auth"

export const dynamic = "force-dynamic"

interface HomeProps {
  searchParams: Promise<{ domain?: string }>
}

function parseDomainParam(raw?: string): Domain | undefined {
  if (raw === "grammar" || raw === "vocabulary") return raw
  return undefined
}

export default async function Home({ searchParams }: HomeProps) {
  const user = await getCurrentUser()
  if (!user) redirect("/welcome")
  const { domain } = await searchParams
  const domainFilter = parseDomainParam(domain)
  const data = await loadHomeData({
    userId: user.id,
    languageId: user.languageId,
    languageCode: user.languageCode,
    domainFilter,
  })
  const DOMAINS = getDomains(user.languageCode)

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-16 text-zinc-100">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <header className="flex flex-col gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{t.appTitle}</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Single-user personal trainer — entraîne-toi, affronte les défis.
            </p>
          </div>
          <UserTierBadge xp={data.lifetimeXp} tier={data.tier} />
        </header>

        <DomainTabs active={domainFilter} />

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
            domainFilter={domainFilter}
            defaultLength={user.defaultDrillLength}
          />
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

        <Card>
          <SectionHeader
            title={t.home.bossesTitle}
            subtitle={t.home.bossesSubtitle}
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {data.bosses.map((b) => (
              <BossTile
                key={`${b.domain}-${b.level}`}
                card={b}
                domains={DOMAINS}
              />
            ))}
          </div>
        </Card>

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

function DomainTabs({ active }: { active: Domain | undefined }) {
  const tabs: Array<{ key: "all" | Domain; label: string; href: string }> = [
    { key: "all", label: t.home.domainAll, href: "/" },
    { key: "grammar", label: t.home.domainGrammar, href: "/?domain=grammar" },
    {
      key: "vocabulary",
      label: t.home.domainVocab,
      href: "/?domain=vocabulary",
    },
  ]
  const activeKey: "all" | Domain = active ?? "all"
  return (
    <div
      role="tablist"
      aria-label={t.home.tabAriaLabel}
      className="flex gap-1 rounded-xl border border-white/10 bg-zinc-900/60 p-1"
    >
      {tabs.map((tab) => {
        const isActive = activeKey === tab.key
        return (
          <Link
            key={tab.key}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            className={`flex-1 rounded-lg px-3 py-1.5 text-center text-sm transition ${
              isActive
                ? "bg-white text-zinc-900"
                : "text-zinc-300 hover:bg-white/5"
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
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

function BossTile({
  card,
  domains,
}: {
  card: BossCard
  domains: DomainsByKey
}) {
  const label = LEVEL_LABELS[card.level] ?? `L${card.level}`
  const domainLabel = t.domains[card.domain]

  if (card.unlocked) {
    return <BossTileButton domain={card.domain as Domain} level={card.level} />
  }

  const { ready, total, bottleneck } = card.progress
  const ratio = total > 0 ? ready / total : 0
  const bottleneckSubLabel = bottleneck
    ? domains[card.domain]?.subs.find((s) => s.key === bottleneck.sub)
        ?.label ?? bottleneck.sub
    : null

  return (
    <div
      className="flex flex-col gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-zinc-400"
      aria-label={`${domainLabel} ${label} ${t.home.bossLocked}`}
    >
      <span className="text-xs uppercase tracking-wide opacity-70">
        {domainLabel}
      </span>
      <span className="text-lg font-semibold text-zinc-300">{label}</span>
      {total > 0 ? (
        <>
          <ProgressBar ratio={ratio} />
          <span className="text-[11px] opacity-80">
            {t.home.bossProgressReady(ready, total)}
          </span>
          {bottleneckSubLabel && (
            <span className="truncate text-[11px] opacity-70">
              {t.home.bossProgressBottleneck(bottleneckSubLabel, label)}
            </span>
          )}
        </>
      ) : (
        <span className="text-[11px] opacity-70">{t.home.bossLocked}</span>
      )}
    </div>
  )
}

function RecentRow({ s }: { s: RecentSession }) {
  const accuracy = s.questionsSeen > 0
    ? Math.round((s.correctCount / s.questionsSeen) * 100)
    : 0
  const modeLabel = s.mode === "boss" && s.bossDomain && s.bossLevel
    ? `Défi ${t.domains[s.bossDomain]} ${LEVEL_LABELS[s.bossLevel]}`
    : s.domainFilter
      ? `${t.domains[s.domainFilter]}`
      : "Entraînement"
  const medal = s.bossMedal ? medalByTier(s.bossMedal) : null
  return (
    <li className="flex items-center justify-between rounded-md bg-white/5 px-3 py-1.5 text-sm">
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-zinc-200">{modeLabel}</span>
        <span className="text-[11px] text-zinc-500">
          {s.questionsSeen} Q · {accuracy}% · {s.ppq.toFixed(2)} ppq
        </span>
      </div>
      {medal ? (
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ backgroundColor: `${medal.color}22`, color: medal.color }}
        >
          {medal.label}
        </span>
      ) : (
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ backgroundColor: `${s.rankTier.color}22`, color: s.rankTier.color }}
        >
          {t.ranks[s.rankTier.name] ?? s.rankTier.name}
        </span>
      )}
    </li>
  )
}
