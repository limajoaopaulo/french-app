"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { startPersonalisedSession } from "@/app/actions/session"
import { t } from "@/lib/i18n"
import { DrillPreview } from "@/components/home/DrillPreview"
import type { PersonalisedTargets } from "@/lib/progression"

export function HomeStart({
  preview,
  defaultLength,
}: {
  preview: PersonalisedTargets | null
  defaultLength: number
}) {
  const router = useRouter()
  const [starting, setStarting] = useState(false)

  const start = async () => {
    if (starting) return
    setStarting(true)
    try {
      const { sessionId } = await startPersonalisedSession({
        length: defaultLength,
        targetTags: preview?.targets.map((tg) => ({
          facet: tg.facet,
          tag: tg.tag,
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

      <button
        type="button"
        disabled={starting}
        onClick={start}
        className="self-start rounded-lg bg-white px-5 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200 disabled:opacity-60"
      >
        {t.home.startDrill(defaultLength)}
      </button>
    </div>
  )
}
