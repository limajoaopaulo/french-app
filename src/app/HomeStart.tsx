"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { startPersonalisedSession } from "@/app/actions/session"
import { t } from "@/lib/i18n"
import { DrillPreview } from "@/components/home/DrillPreview"
import type { PersonalisedTargets } from "@/lib/progression"
import type { Domain } from "@/lib/taxonomy"

const LENGTHS = [5, 10, 15, 20] as const

export function HomeStart({
  preview,
  domainFilter,
}: {
  preview: PersonalisedTargets | null
  domainFilter?: Domain
}) {
  const router = useRouter()
  const [length, setLength] = useState<number>(10)
  const [starting, setStarting] = useState(false)

  const start = async () => {
    if (starting) return
    setStarting(true)
    try {
      const { sessionId } = await startPersonalisedSession({
        length,
        domainFilter,
        targetSubs: preview?.subs.map((s) => ({
          domain: s.domain,
          sub: s.sub,
        })),
        levelRange: preview?.range
          ? { min: preview.range.min, max: preview.range.max }
          : undefined,
      })
      router.push(`/session/${sessionId}`)
    } catch (e) {
      setStarting(false)
      throw e
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <DrillPreview preview={preview} />

      <div className="flex gap-2" role="radiogroup" aria-label="Longueur du drill">
        {LENGTHS.map((n) => {
          const active = n === length
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setLength(n)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                active
                  ? "border-emerald-400 bg-emerald-500/15 text-emerald-100"
                  : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
              }`}
            >
              {n} Q
            </button>
          )
        })}
      </div>

      <button
        type="button"
        disabled={starting || !preview}
        onClick={start}
        className="self-start rounded-lg bg-white px-5 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200 disabled:opacity-60"
      >
        {t.home.startDrill(length)}
      </button>
    </div>
  )
}
