/**
 * Мини-donut для метрик (например % посещаемости).
 * r=18, stroke=4, терракотовая заливка по доле pct (0..1).
 */
export function Donut({
  pct,
  size = 44,
  strokeWidth = 4,
  color = "#c96442",
  track = "#e8e6dc",
}: {
  pct: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  track?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(1, pct)));
  const cx = size / 2;
  const cy = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={track}
        strokeWidth={strokeWidth}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    </svg>
  );
}
