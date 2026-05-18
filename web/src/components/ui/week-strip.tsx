/**
 * Визуальная напоминалка расписания — 7 дней недели.
 * Активные дни подсвечены с временем. Декоративный, не кликабельный.
 */
const DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function WeekStrip({
  slots,
}: {
  slots: Array<{ weekday: number; time_at: string }>; // weekday 1..7 (ISO)
}) {
  return (
    <div
      className="grid grid-cols-7 gap-1 p-[10px] bg-ivory rounded-[12px] shadow-ring"
      style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
    >
      {DAYS.map((d, idx) => {
        const iso = idx + 1; // 1..7
        const slot = slots.find((s) => s.weekday === iso);
        const active = Boolean(slot);
        return (
          <div key={d} className="flex flex-col items-center gap-[5px]">
            <div className="text-[10px] font-medium uppercase tracking-[0.4px] text-stone">
              {d}
            </div>
            <div
              className={`w-full h-[34px] rounded-[8px] flex items-center justify-center text-[11px] font-medium tabular-nums ${
                active
                  ? "bg-[rgba(201,100,66,0.12)] text-terracotta"
                  : "text-stone"
              }`}
              style={!active ? { boxShadow: "inset 0 0 0 1px #f0eee6" } : {}}
            >
              {active ? slot!.time_at.slice(0, 5) : "·"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
