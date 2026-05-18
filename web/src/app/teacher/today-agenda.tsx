import Link from "next/link";
import type { AgendaItem } from "@/lib/repos/schedules";
import type { LessonListItem } from "@/lib/repos/lessons";
import type { LessonStatus } from "@/lib/types";
import { LESSON_STATUS_LABEL } from "@/lib/types";
import { Chip } from "@/components/ui/chip";

function fmtShortDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

/**
 * Повестка дня учителя — БЕЗ кнопок.
 * Слоты — только напоминание. Записать урок можно через FAB + снизу.
 */
function relativeTime(slotTime: string, forDate: string): string | null {
  const today = new Date().toLocaleDateString("sv-SE");
  if (forDate !== today) return null;
  const parts = slotTime.split(":").map(Number);
  const h = parts[0];
  const m = parts[1];
  if (h === undefined || m === undefined || isNaN(h) || isNaN(m)) return null;
  const now = new Date();
  const slot = new Date();
  slot.setHours(h, m, 0, 0);
  const diffMin = Math.round((slot.getTime() - now.getTime()) / 60000);
  if (diffMin >= -30 && diffMin <= 30 && diffMin !== 0) {
    if (diffMin < 0 && diffMin > -60) return "идёт сейчас";
    if (diffMin > 0 && diffMin < 60) return `через ${diffMin} мин`;
  }
  if (diffMin > 60 && diffMin < 480) {
    const hours = Math.floor(diffMin / 60);
    return `через ${hours} ч`;
  }
  if (diffMin <= -60 && diffMin > -240) {
    const hours = Math.floor(-diffMin / 60);
    return `был ${hours} ч назад`;
  }
  return null;
}

function statusChip(status: LessonStatus) {
  if (status === "conducted") return <Chip tone="good" size="s">проведён</Chip>;
  if (status === "penalty") return <Chip tone="bad" size="s">штраф</Chip>;
  return <Chip tone="amber" size="s">{LESSON_STATUS_LABEL[status]}</Chip>;
}

export function TodayAgenda({
  agenda,
  date,
  recentLessons = [],
}: {
  agenda: AgendaItem[];
  date: string;
  recentLessons?: LessonListItem[];
}) {
  const scheduled = agenda.filter((a) => a.kind === "scheduled");
  const done = agenda.filter((a) => a.kind === "lesson");
  const conducted = done.filter((a) => a.lesson_status === "conducted").length;
  const penalty = done.filter((a) => a.lesson_status === "penalty").length;
  const cancelled = done.length - conducted - penalty;
  const counted = conducted + penalty; // засчитано с баланса
  const total = done.length;

  return (
    <section className="mb-6">
      {/* Счётчик проведённых за день — без планов, только факты */}
      {total > 0 && (
        <div
          className="bg-ivory rounded-[16px] p-5 mb-4"
          style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
        >
          <div className="flex items-end justify-between mb-3">
            <div>
              <div className="font-serif text-[44px] font-medium tabular-nums leading-none tracking-[-0.6px]">
                {counted}
              </div>
              <div className="text-[12px] text-olive mt-2 uppercase tracking-[0.6px] font-medium">
                {counted === 1 ? "урок засчитан" : counted < 5 ? "урока засчитано" : "уроков засчитано"}
              </div>
            </div>
            <div className="flex flex-col gap-[6px] items-end">
              {conducted > 0 && <Chip tone="good" size="s">{conducted} провёл</Chip>}
              {penalty > 0 && <Chip tone="bad" size="s">{penalty} штраф</Chip>}
              {cancelled > 0 && <Chip tone="amber" size="s">{cancelled} отм.</Chip>}
            </div>
          </div>

          {/* Чистый stacked-bar пропорционально статусам */}
          {(conducted + penalty + cancelled) > 0 && (
            <div className="flex gap-[2px] h-[6px] rounded-full overflow-hidden">
              {conducted > 0 && (
                <div className="bg-moss h-full" style={{ flex: conducted }} />
              )}
              {penalty > 0 && (
                <div className="bg-crimson h-full" style={{ flex: penalty }} />
              )}
              {cancelled > 0 && (
                <div className="h-full" style={{ flex: cancelled, backgroundColor: "#d4911d" }} />
              )}
            </div>
          )}
        </div>
      )}

      {scheduled.length === 0 && done.length === 0 && (
        <div className="bg-ivory rounded-[14px] shadow-ring py-10 text-center">
          <p className="text-olive">На этот день ничего не запланировано.</p>
          <Link
            href={`/teacher/lesson/new?date=${date}`}
            className="text-terracotta text-sm no-underline mt-2 inline-block"
          >
            Добавить урок →
          </Link>
        </div>
      )}

      {/* Слоты — просто напоминание, без кнопок */}
      {scheduled.length > 0 && (
        <section className="mb-4">
          <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mb-2">
            По расписанию
          </div>
          <div className="flex flex-col gap-[8px]">
            {scheduled.map((a) => {
              const isLow = a.student_balance <= 0;
              const relTime = a.slot_time ? relativeTime(a.slot_time, date) : null;
              return (
                <Link
                  key={`${a.student_id}-${a.slot_time}`}
                  href={`/teacher/student/${a.student_id}`}
                  className="bg-ivory rounded-[14px] shadow-ring px-4 py-3 flex items-center gap-[14px] no-underline text-near-black"
                >
                  <div className="font-serif text-[18px] font-medium tabular-nums min-w-[52px] tracking-[-0.2px]">
                    {a.slot_time ?? "—"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[15px] font-medium truncate">{a.student_name}</span>
                      {isLow && <Chip tone="bad" size="s">низкий баланс</Chip>}
                      {relTime && (
                        <span
                          className={
                            relTime === "идёт сейчас"
                              ? "text-[12px] text-terracotta font-medium"
                              : "text-[12px] text-olive font-medium"
                          }
                        >
                          {relTime}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Последние уроки */}
      {recentLessons.length > 0 && (
        <section>
          <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mb-2">
            Последние уроки
          </div>
          <div
            className="bg-ivory rounded-[14px] px-4"
            style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
          >
            {recentLessons.map((l, i) => (
              <Link
                key={l.id}
                href={`/teacher/student/${l.student_id}`}
                className={`grid grid-cols-[1fr_auto] items-center gap-3 py-[12px] no-underline text-near-black ${
                  i > 0 ? "border-t border-border-cream" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="text-[15px] font-medium truncate">
                    {l.student_name}
                  </div>
                  <div className="text-[12px] text-olive tabular-nums mt-0.5">
                    {fmtShortDate(l.lesson_date)}
                    {l.topic ? ` · ${l.topic}` : ""}
                  </div>
                </div>
                {statusChip(l.status)}
              </Link>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
