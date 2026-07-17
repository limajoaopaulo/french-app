import type { PersonalisedTargets } from "@/lib/progression"
import { t } from "@/lib/i18n"

export function DrillPreview({
  preview,
}: {
  preview: PersonalisedTargets | null
}) {
  if (!preview) {
    return (
      <p className="text-sm text-zinc-500">
        Réponds à quelques questions et l&apos;app ciblera tes points faibles.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/5 bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-center gap-2">
        {preview.targets.map((tg) => (
          <span
            key={`${tg.facet}-${tg.tag}`}
            className="rounded-md border border-sky-400/30 bg-sky-500/10 px-2 py-0.5 text-xs text-sky-100"
          >
            {tg.label}
          </span>
        ))}
        <span className="rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-100">
          {preview.range.label}
        </span>
      </div>
      {preview.weakTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wide text-zinc-500">
            {t.home.focusTags}
          </span>
          {preview.weakTags.map((wt) => (
            <span
              key={`${wt.facet}-${wt.tag}`}
              className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-300"
            >
              {wt.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
