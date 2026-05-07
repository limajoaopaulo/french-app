interface Props {
  // 0..1, clamped.
  ratio: number
  // Optional explicit color; when omitted, picks emerald/amber/rose by ratio.
  color?: string
  className?: string
}

export function ProgressBar({ ratio, color, className }: Props) {
  const clamped = Math.max(0, Math.min(1, ratio))
  const fill =
    color ??
    (clamped < 0.34 ? "#f43f5e" : clamped < 0.67 ? "#f59e0b" : "#10b981")
  return (
    <div
      className={`h-1 overflow-hidden rounded-full bg-white/5 ${className ?? ""}`}
      role="progressbar"
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.round(clamped * 100)}%`, backgroundColor: fill }}
      />
    </div>
  )
}
