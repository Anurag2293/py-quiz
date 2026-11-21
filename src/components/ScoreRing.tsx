export function ScoreRing({ value, total, size = 112 }: { value: number; total: number; size?: number }) {
  const r = 44
  const c = 2 * Math.PI * r
  const frac = total ? value / total : 0
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" className="stroke-muted" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          className="stroke-primary transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular-nums">{Math.round(frac * 100)}%</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {value}/{total}
        </span>
      </div>
    </div>
  )
}
