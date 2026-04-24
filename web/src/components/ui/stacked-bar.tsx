/**
 * Горизонтальный stacked bar 6×24r с тремя сегментами: проведено / штраф / отменено.
 */
export function StackedBar({
  conducted,
  penalty,
  cancelled,
}: {
  conducted: number;
  penalty: number;
  cancelled: number;
}) {
  const total = conducted + penalty + cancelled;
  if (total === 0) return null;
  const pctC = (conducted / total) * 100;
  const pctP = (penalty / total) * 100;
  const pctX = (cancelled / total) * 100;

  return (
    <div className="w-full h-[6px] rounded-full bg-warm-sand flex overflow-hidden">
      {conducted > 0 && (
        <div className="h-full bg-moss" style={{ width: `${pctC}%` }} />
      )}
      {penalty > 0 && (
        <div className="h-full bg-crimson" style={{ width: `${pctP}%` }} />
      )}
      {cancelled > 0 && (
        <div className="h-full bg-terracotta" style={{ width: `${pctX}%` }} />
      )}
    </div>
  );
}
