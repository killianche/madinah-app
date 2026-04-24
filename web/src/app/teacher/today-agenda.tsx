import Link from "next/link";
import type { AgendaItem } from "@/lib/repos/schedules";
import { LESSON_STATUS_LABEL } from "@/lib/types";

/**
 * Повестка дня учителя.
 * Слоты расписания — просто напоминалки (без кнопок отметки).
 * Уроки отмечаются через форму «Добавить урок».
 */
export function TodayAgenda({ agenda, date }: { agenda: AgendaItem[]; date: string }) {
  const scheduled = agenda.filter((a) => a.kind === "scheduled");
  const done = agenda.filter((a) => a.kind === "lesson");

  return (
    <div className="space-y-6">
      {scheduled.length === 0 && done.length === 0 && (
        <div className="bg-ivory rounded-md shadow-ring py-10 text-center">
          <p className="text-olive-gray">На этот день ничего не запланировано.</p>
          <Link
            href={`/teacher/lesson/new?date=${date}`}
            className="text-terracotta text-sm no-underline mt-2 inline-block"
          >
            Добавить урок →
          </Link>
        </div>
      )}

      {scheduled.length > 0 && (
        <section>
          <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mb-3">
            По расписанию — {scheduled.length}{" "}
            {scheduled.length === 1 ? "ученик" : scheduled.length < 5 ? "ученика" : "учеников"}
          </div>
          <ul className="space-y-[10px]">
            {scheduled.map((a) => (
              <li
                key={`${a.student_id}-${a.slot_time}`}
                className="bg-ivory rounded-[16px] shadow-ring p-5 grid grid-cols-[auto_1fr_auto] gap-[18px] items-center"
              >
                <span className="font-serif text-[25px] font-medium tabular-nums text-near-black leading-none">
                  {a.slot_time ?? "—"}
                </span>
                <div className="min-w-0">
                  <Link
                    href={`/teacher/student/${a.student_id}`}
                    className="font-medium text-[17px] text-near-black truncate no-underline hover:text-terracotta"
                  >
                    {a.student_name}
                  </Link>
                  <p className="text-[14px] text-olive mt-0.5">
                    Осталось {Math.max(a.student_balance, 0)}{" "}
                    {a.student_balance <= 0 && (
                      <span className="text-crimson ml-1">· нужно пополнить</span>
                    )}
                  </p>
                </div>
                <svg
                  className="w-5 h-5 text-stone self-end mb-0.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </li>
            ))}
          </ul>
        </section>
      )}

      {done.length > 0 && (
        <section>
          <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mb-3">
            Записано — {done.length}
          </div>
          <ul className="space-y-[10px]">
            {done.map((a) => (
              <li
                key={a.lesson_id}
                className="bg-ivory rounded-[16px] shadow-ring p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-[17px] font-medium truncate">
                    {a.student_name}
                  </div>
                  <div className="text-[14px] text-olive mt-0.5">
                    {a.slot_time ?? "—"} · {LESSON_STATUS_LABEL[a.lesson_status!]}
                  </div>
                </div>
                <span className="font-serif text-[22px] tabular-nums text-olive">
                  {Math.max(a.student_balance, 0)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
