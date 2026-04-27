import Link from "next/link"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { getDomains, type Domain } from "@/lib/taxonomy"
import { SubToggle } from "./SubToggle"
import { t } from "@/lib/i18n"
import { getCurrentUser } from "@/lib/auth"

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/welcome")
  const rows = await prisma.subStats.findMany({ where: { userId: user.id } })
  const byKey = new Map(rows.map((r) => [`${r.domain}:${r.sub}`, r.isActive]))
  const DOMAINS = getDomains(user.languageCode)

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{t.settings.title}</h1>
          <Link
            href="/"
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-white/5"
          >
            {t.settings.back}
          </Link>
        </header>

        <p className="text-sm text-zinc-400">{t.settings.hint}</p>

        {(Object.keys(DOMAINS) as Domain[]).map((domain) => {
          const info = DOMAINS[domain]
          return (
            <section
              key={domain}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-900/60 p-5"
            >
              <h2 className="text-lg font-semibold" style={{ color: info.color }}>
                {info.label}
              </h2>
              <ul className="flex flex-col gap-2">
                {info.subs.map((s) => (
                  <SubToggle
                    key={s.key}
                    domain={domain}
                    sub={s.key}
                    label={s.label}
                    hint={s.hint}
                    initialActive={byKey.get(`${domain}:${s.key}`) ?? false}
                  />
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </main>
  )
}
