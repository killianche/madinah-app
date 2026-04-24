/**
 * Маленький спарклайн — столбики по дням.
 * data[i] = значение за день (0..).
 */
export function Sparkline({
  data,
  width = 280,
  height = 36,
  color = "#c96442",
  track = "#e8e6dc",
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  track?: string;
}) {
  if (data.length === 0) return null;
  const max = Math.max(1, ...data);
  const n = data.length;
  const gap = 2;
  const barW = Math.max(2, Math.floor((width - gap * (n - 1)) / n));
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {data.map((v, i) => {
        const h = Math.round((v / max) * height);
        const x = i * (barW + gap);
        const y = height - h;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={h || 1}
            rx={1}
            fill={v > 0 ? color : track}
          />
        );
      })}
    </svg>
  );
}
