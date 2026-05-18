const DAYS = [
  { wd: 1, short: "ПН" },
  { wd: 2, short: "ВТ" },
  { wd: 3, short: "СР" },
  { wd: 4, short: "ЧТ" },
  { wd: 5, short: "ПТ" },
  { wd: 6, short: "СБ" },
  { wd: 7, short: "ВС" },
];

const HOUR_FROM = 6;
const HOUR_TO = 23;
function buildHalfHours(): string[] {
  const out: string[] = [];
  for (let h = HOUR_FROM; h <= HOUR_TO; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
    out.push(`${String(h).padStart(2, "0")}:30`);
  }
  return out;
}
const HALF_HOURS = buildHalfHours();

export function AvailabilityView({
  slots,
}: {
  slots: Array<{ weekday: number; time_at: string }>;
}) {
  if (slots.length === 0) {
    return (
      <div
        className="bg-ivory rounded-[14px] py-6 text-center"
        style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
      >
        <p className="text-olive text-[13px]">Учитель ещё не указал расписание.</p>
      </div>
    );
  }

  const set = new Set(slots.map((s) => `${s.weekday}|${s.time_at}`));

  return (
    <div
      className="bg-ivory rounded-[14px] p-3"
      style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
    >
      <div className="grid grid-cols-[60px_1fr] gap-2">
        <div className="text-[10px] text-stone font-medium uppercase tracking-[0.4px]"></div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {DAYS.map((d) => (
            <div key={d.wd} className="text-[10px] text-stone font-medium uppercase tracking-[0.4px]">
              {d.short}
            </div>
          ))}
        </div>

        {HALF_HOURS.map((t) => {
          const anyOn = DAYS.some((d) => set.has(`${d.wd}|${t}`));
          if (!anyOn) return null;
          return (
            <div key={t} className="contents">
              <div className="text-[11px] text-olive tabular-nums self-center">{t}</div>
              <div className="grid grid-cols-7 gap-1">
                {DAYS.map((d) => {
                  const on = set.has(`${d.wd}|${t}`);
                  return (
                    <div
                      key={d.wd}
                      className={`h-6 rounded-[4px] ${
                        on ? "bg-terracotta" : ""
                      }`}
                      style={!on ? { boxShadow: "inset 0 0 0 1px #f0eee6" } : {}}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-[11px] text-stone mt-3 tabular-nums">
        {slots.length} получасовых слотов
      </div>
    </div>
  );
}
