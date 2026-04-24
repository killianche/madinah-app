"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { AgendaItem } from "@/lib/repos/schedules";
import type { LessonStatus } from "@/lib/types";
import { LESSON_STATUS_LABEL } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { quickLogLessonAction } from "./lesson/new/actions";

/**
 * Повестка дня учителя.
 * Сверху — слоты по расписанию (напоминалки) с кнопками быстрой отметки.
 * Ниже — уже записанные за день уроки.
 * Расписание ни на что не влияет: урок можно добавить в любой момент.
 */
export function TodayAgenda({ agenda, date }: { agenda: AgendaItem[]; date: string }) {
  const scheduled = agenda.filter((a) => a.kind === "scheduled");
  const done = agenda.filter((a) => a.kind === "lesson");

  return (
    <div className="space-y-6">
      {scheduled.length === 0 && done.length === 0 && (
        <div className="card text-center py-10">
          <p className="text-olive-gray">На этот день уроков не запланировано.</p>
          <Link href={`/teacher/lesson/new?date=${date}`} className="text-terracotta text-sm no-underline mt-2 inline-block">
            Добавить урок →
          </Link>
        </div>
      )}

      {scheduled.length > 0 && (
        <section>
          <h2 className="text-sm uppercase tracking-wider text-olive-gray mb-2">
            Напоминалки по расписанию ({scheduled.length})
          </h2>
          <ul className="space-y-2">
            {scheduled.map((a) => (
              <ScheduledRow key={`${a.student_id}-${a.slot_time}`} a={a} date={date} />
            ))}
          </ul>
        </section>
      )}

      {done.length > 0 && (
        <section>
          <h2 className="text-sm uppercase tracking-wider text-olive-gray mb-2">
            Записано ({done.length})
          </h2>
          <ul className="space-y-2">
            {done.map((a) => (
              <li key={a.lesson_id} className="card-compact">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-sm font-medium truncate">{a.student_name}</span>
                    <p className="text-xs text-olive-gray mt-0.5">
                      {a.slot_time ?? "—"} · {LESSON_STATUS_LABEL[a.lesson_status!]}
                    </p>
                  </div>
                  <span className="font-serif text-lg tabular-nums text-olive-gray">
                    {Math.max(a.student_balance, 0)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ScheduledRow({ a, date }: { a: AgendaItem; date: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<LessonStatus | null>(null);

  function quick(status: LessonStatus) {
    setError(undefined);
    startTransition(async () => {
      const res = await quickLogLessonAction({
        student_id: a.student_id,
        lesson_date: date,
        lesson_time: a.slot_time,
        status,
      });
      if (res.ok) {
        setSaved(status);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <li
      className={cn(
        "card-compact transition-opacity",
        saved && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-serif tabular-nums text-sm text-olive-gray w-12 shrink-0">
              {a.slot_time ?? "—"}
            </span>
            <Link
              href={`/teacher/student/${a.student_id}`}
              className="font-medium truncate hover:text-terracotta no-underline"
            >
              {a.student_name}
            </Link>
          </div>
          <p className="text-xs text-olive-gray mt-1 ml-14">
            Баланс: {Math.max(a.student_balance, 0)}
            {a.student_balance <= 0 && <span className="text-terracotta ml-1">· нужно пополнить</span>}
          </p>
          {error && <p className="text-xs text-terracotta mt-1 ml-14">{error}</p>}
          {saved && <p className="text-xs text-olive-gray mt-1 ml-14">Сохранено: {LESSON_STATUS_LABEL[saved]}</p>}
        </div>
      </div>
      {!saved && (
        <div className="flex gap-2 mt-3 ml-14">
          <Button
            size="sm"
            variant="primary"
            disabled={pending}
            onClick={() => quick("conducted")}
          >
            ✓ Провёл
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => quick("cancelled_by_student")}
          >
            Отменён учеником
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => quick("penalty")}
          >
            Штраф
          </Button>
        </div>
      )}
    </li>
  );
}
