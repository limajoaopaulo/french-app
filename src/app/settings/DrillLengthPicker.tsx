"use client"

import { useState, useTransition } from "react"
import { setDefaultDrillLength } from "@/app/actions/settings"
import { t } from "@/lib/i18n"

const LENGTHS = [5, 10, 15, 20] as const

interface Props {
  initial: number
}

export function DrillLengthPicker({ initial }: Props) {
  const [length, setLength] = useState<number>(initial)
  const [pending, startTransition] = useTransition()

  const onPick = (n: 5 | 10 | 15 | 20) => {
    if (pending || n === length) return
    const previous = length
    setLength(n)
    startTransition(async () => {
      try {
        await setDefaultDrillLength({ length: n })
      } catch {
        setLength(previous)
      }
    })
  }

  return (
    <div
      role="radiogroup"
      aria-label={t.settings.drillLengthTitle}
      className="flex gap-2"
    >
      {LENGTHS.map((n) => {
        const active = n === length
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={pending}
            onClick={() => onPick(n)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition disabled:opacity-60 ${
              active
                ? "border-emerald-400 bg-emerald-500/15 text-emerald-100"
                : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
            }`}
          >
            {t.settings.drillLengthOption(n)}
          </button>
        )
      })}
    </div>
  )
}
