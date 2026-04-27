"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { startBossSession } from "@/app/actions/session"
import { LEVEL_LABELS } from "@/lib/constants"
import { t } from "@/lib/i18n"
import type { Domain } from "@/lib/taxonomy"

interface Props {
  domain: Domain
  level: number
}

export function BossTileButton({ domain, level }: Props) {
  const router = useRouter()
  const [starting, setStarting] = useState(false)
  const label = LEVEL_LABELS[level] ?? `L${level}`
  const domainLabel = t.domains[domain]

  const onClick = async () => {
    if (starting) return
    setStarting(true)
    try {
      const { sessionId } = await startBossSession({ domain, level })
      router.push(`/session/${sessionId}`)
    } catch (e) {
      setStarting(false)
      throw e
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={starting}
      aria-label={`${domainLabel} ${label} ${t.home.bossUnlocked}`}
      className="flex flex-col gap-1 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-amber-100 transition hover:bg-amber-500/20 disabled:opacity-60"
    >
      <span className="text-xs uppercase tracking-wide opacity-70">{domainLabel}</span>
      <span className="text-lg font-semibold">{label}</span>
      <span className="text-[11px] opacity-70">{t.home.bossUnlocked}</span>
    </button>
  )
}
