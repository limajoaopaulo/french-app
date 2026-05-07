import { ProgressBar } from "@/components/ui/ProgressBar"
import { t } from "@/lib/i18n"
import type { UserTierInfo } from "@/lib/points"

interface Props {
  xp: number
  tier: UserTierInfo
}

export function UserTierBadge({ xp, tier }: Props) {
  const label = t.tiers[tier.name] ?? tier.name
  const xpInTier = Math.max(0, xp - tier.min)
  const span = tier.nextMin !== null ? tier.nextMin - tier.min : 0
  const ratio = span > 0 ? xpInTier / span : 1
  const remaining = tier.nextMin !== null ? Math.max(0, tier.nextMin - xp) : null
  const xpRounded = Math.round(xp)

  return (
    <div
      className="flex flex-col gap-1.5 rounded-xl border bg-zinc-900/60 px-4 py-2"
      style={{ borderColor: `${tier.color}55` }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider"
          style={{ color: tier.color }}
        >
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: tier.color }}
          />
          {label}
        </span>
        <span className="text-xs text-zinc-300">
          {t.home.lifetimeXp(xpRounded)}
        </span>
      </div>
      {tier.nextMin !== null && (
        <>
          <ProgressBar ratio={ratio} color={tier.color} />
          <span className="text-[11px] text-zinc-500">
            {t.home.nextTier(Math.round(remaining ?? 0))}
          </span>
        </>
      )}
    </div>
  )
}
