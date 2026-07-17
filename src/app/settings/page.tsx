import Link from "next/link"
import { redirect } from "next/navigation"
import { DrillLengthPicker } from "./DrillLengthPicker"
import { t } from "@/lib/i18n"
import { getCurrentUser } from "@/lib/auth"

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/welcome")

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

        <section className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
          <div>
            <h2 className="text-lg font-semibold">
              {t.settings.drillLengthTitle}
            </h2>
            <p className="text-sm text-zinc-400">
              {t.settings.drillLengthHint}
            </p>
          </div>
          <DrillLengthPicker initial={user.defaultDrillLength} />
        </section>

        <p className="text-sm text-zinc-400">{t.settings.hint}</p>
      </div>
    </main>
  )
}
