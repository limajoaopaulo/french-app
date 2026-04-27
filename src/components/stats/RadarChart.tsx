interface Axis {
  label: string
  value: number
}

interface Props {
  title: string
  axes: Axis[]
  size?: number
  max?: number
  stroke?: string
  fill?: string
}

export function RadarChart({
  title,
  axes,
  size = 320,
  max = 5,
  stroke = "#6366f1",
  fill = "#6366f1",
}: Props) {
  const n = axes.length
  const cx = size / 2
  const cy = size / 2
  const padding = 44
  const radius = Math.max(0, size / 2 - padding)

  const angleFor = (i: number) => -Math.PI / 2 + (i / n) * 2 * Math.PI

  const axisPoints = axes.map((_, i) => {
    const a = angleFor(i)
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) }
  })

  const rings = [0.2, 0.4, 0.6, 0.8, 1.0]
  const ringPolygons = rings.map((r) => ringPolygon(cx, cy, radius * r, n))

  const dataPoints = axes.map((axis, i) => {
    const v = Math.min(max, Math.max(0, axis.value))
    const frac = v / max
    const a = angleFor(i)
    return {
      x: cx + radius * frac * Math.cos(a),
      y: cy + radius * frac * Math.sin(a),
    }
  })
  const dataPolygon = dataPoints.map((p) => `${p.x},${p.y}`).join(" ")

  return (
    <figure className="flex flex-col items-center gap-2">
      <figcaption className="text-sm font-semibold text-zinc-200">{title}</figcaption>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={title}
      >
        {ringPolygons.map((pts, i) => (
          <polygon
            key={i}
            points={pts}
            fill="none"
            stroke="#ffffff14"
            strokeWidth={1}
          />
        ))}
        {axisPoints.map((p, i) => (
          <line
            key={`axis-${i}`}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="#ffffff14"
            strokeWidth={1}
          />
        ))}
        <polygon
          points={dataPolygon}
          fill={fill}
          fillOpacity={0.18}
          stroke={stroke}
          strokeWidth={1.5}
        />
        {dataPoints.map((p, i) => (
          <circle key={`dot-${i}`} cx={p.x} cy={p.y} r={2.5} fill={stroke} />
        ))}
        {axes.map((axis, i) => {
          const a = angleFor(i)
          const labelR = radius + 14
          const x = cx + labelR * Math.cos(a)
          const y = cy + labelR * Math.sin(a)
          const anchor =
            Math.abs(Math.cos(a)) < 0.15 ? "middle" : Math.cos(a) > 0 ? "start" : "end"
          return (
            <text
              key={`label-${i}`}
              x={x}
              y={y}
              textAnchor={anchor}
              dominantBaseline="middle"
              className="fill-zinc-400"
              style={{ fontSize: 10 }}
            >
              {axis.label}
            </text>
          )
        })}
      </svg>
    </figure>
  )
}

function ringPolygon(cx: number, cy: number, r: number, n: number): string {
  const points: string[] = []
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / n) * 2 * Math.PI
    points.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`)
  }
  return points.join(" ")
}
