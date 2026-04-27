import { t } from "@/lib/i18n"

export interface PatternRow {
  pattern: string
  meanR: number
  meanStability: number
  cardCount: number
  lastSeenAt: Date | null
}

export function PatternBreakdown({ patterns }: { patterns: PatternRow[] }) {
  if (patterns.length === 0) return null
  return (
    <ul className="flex flex-col gap-1.5 pt-2">
      {patterns.map((p) => {
        const seen = p.cardCount > 0 && p.meanR > 0
        const r = p.meanR
        const color = !seen
          ? "#71717a"
          : r < 0.6
            ? "#f43f5e"
            : r < 0.85
              ? "#f59e0b"
              : "#10b981"
        return (
          <li key={p.pattern} className="flex flex-col gap-1 rounded-md bg-white/5 px-2.5 py-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-zinc-300">{p.pattern}</span>
              <span className="text-zinc-400">
                {seen
                  ? `R=${(r * 100).toFixed(0)}% · S=${p.meanStability.toFixed(1)}d`
                  : t.stats.unanswered}
                <span className="ml-2 text-[10px] text-zinc-500">
                  {p.cardCount} cartes
                </span>
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${seen ? Math.round(r * 100) : 0}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
