import { rankTier } from "@/lib/points"
import { t } from "@/lib/i18n"

interface Props {
  ppq: number
}

export function RankBadge({ ppq }: Props) {
  const tier = rankTier(ppq)
  const label = t.ranks[tier.name] ?? tier.name
  return (
    <div
      className="inline-flex items-center gap-3 rounded-full border px-5 py-2"
      style={{ borderColor: tier.color, color: tier.color }}
    >
      <span
        className="inline-block h-3 w-3 rounded-full"
        style={{ background: tier.color }}
      />
      <span className="text-lg font-semibold uppercase tracking-wider">{label}</span>
    </div>
  )
}
