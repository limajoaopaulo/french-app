"use client"

import { useState, useTransition } from "react"
import { toggleActiveSub } from "@/app/actions/settings"
import type { Domain } from "@/lib/taxonomy"

interface Props {
  domain: Domain
  sub: string
  label: string
  hint: string
  initialActive: boolean
}

export function SubToggle({ domain, sub, label, hint, initialActive }: Props) {
  const [active, setActive] = useState(initialActive)
  const [pending, startTransition] = useTransition()

  const onToggle = () => {
    const next = !active
    setActive(next)
    startTransition(async () => {
      try {
        await toggleActiveSub({ domain, sub, isActive: next })
      } catch {
        setActive(!next)
      }
    })
  }

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        disabled={pending}
        className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition ${
          active
            ? "border-emerald-400/50 bg-emerald-500/10"
            : "border-white/10 bg-white/[0.03] hover:bg-white/5"
        }`}
      >
        <span className="flex flex-col">
          <span className="text-sm font-medium text-zinc-100">{label}</span>
          <span className="text-xs text-zinc-400">{hint}</span>
        </span>
        <span
          className={`inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition ${
            active ? "border-emerald-400 bg-emerald-400/30" : "border-white/20 bg-white/10"
          }`}
          aria-hidden
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white transition ${
              active ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </span>
      </button>
    </li>
  )
}
