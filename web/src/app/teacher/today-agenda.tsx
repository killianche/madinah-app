"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { AgendaItem } from "@/lib/repos/schedules";
import type { LessonStatus } from "@/lib/types";
import { LESSON_STATUS_LABEL } from "@/lib/types";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/cn";
import { quickLogLessonAction } from "./lesson/new/actions";

/**
 * Повестка дня учителя.
 * Сверху — прогресс «провёл N из M» + бар.
 * Слоты на сегодня с 3 кнопками отметки и относительным временем.
 * Ниже — секция «Записано» с уже отмеченными уроками.
 */
function relativeTime(slotTime: string, forDate: string): string | null {
  const today = new Date().toISOString().slice(0, 10);
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

export function TodayAgenda({ agenda, date }: { agenda: AgendaItem[]; date: string }) {
  const scheduled = agenda.filter((a) => a.kind === "scheduled");
  const done = agenda.filter((a) => a.kind === "lesson");
  const heldCount = done.filter((a) => a.lesson_status === "conducted").length;
  const planned = scheduled.length + done.length;

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone">
          Сегодня
        </div>
        {planned > 0 && (
          <span className="text-[13px] font-medium text-charcoal tabular-nums">
            провёл {heldCount} из {planned}
          </span>
        )}
      </div>

      {planned > 0 && (
        <div className="h-1 rounded-full bg-warm-sand overflow-hidden mb-[14px]">
          <div
            className="h-full bg-terracotta transition-[width]"
            style={{ width: `${(heldCount / planned) * 100}%` }}
          />
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

      {/* Слоты с кнопками */}
      {scheduled.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          {scheduled.map((a) => (
            <ScheduledCard key={`${a.student_id}-${a.slot_time}`} a={a} date={date} />
          ))}
        </div>
      )}

      {/* Уже записанные */}
      {done.length > 0 && (
        <>
          <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mt-4 mb-2 px-1">
            Записано
          </div>
          <div className="flex flex-col gap-[6px]">
            {done.map((a) => (
              <div
                key={a.lesson_id}
                className="bg-ivory rounded-[12px] shadow-ring grid grid-cols-[52px_1fr_auto] items-center gap-[14px] px-[14px] py-[10px]"
              >
                <div className="font-serif text-[17px] font-medium tabular-nums">
                  {a.slot_time ?? "—"}
                </div>
                <div className="text-[15px] font-medium truncate">
                  {a.student_name}
                </div>
                {statusChip(a.lesson_status!)}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function statusChip(status: LessonStatus) {
  if (status === "conducted") return <Chip tone="good" size="s">проведён</Chip>;
  if (status === "penalty") return <Chip tone="bad" size="s">штраф</Chip>;
  return <Chip tone="warn" size="s">{LESSON_STATUS_LABEL[status]}</Chip>;
}

function ScheduledCard({ a, date }: { a: AgendaItem; date: string }) {
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

  const isLow = a.student_balance <= 0;
  const relTime = a.slot_time ? relativeTime(a.slot_time, date) : null;

  return (
    <div
      className={cn(
        "bg-ivory rounded-[14px] shadow-ring p-[14px] transition-opacity",
        saved && "opacity-60",
      )}
    >
      <div className="flex items-center gap-[14px]">
        <div className="font-serif text-[20px] font-medium tabular-nums min-w-[52px] tracking-[-0.2px]">
          {a.slot_time ?? "—"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/teacher/student/${a.student_id}`}
              className="text-[15px] font-medium text-near-black no-underline hover:text-terracotta truncate"
            >
              {a.student_name}
            </Link>
            {isLow && (
              <Chip tone="bad" size="s">
                низкий баланс
              </Chip>
            )}
            {relTime && (
              <span
                className={cn(
                  "text-[12px] font-medium",
                  relTime === "идёт сейчас" ? "text-terracotta" : "text-olive",
                )}
              >
                {relTime}
              </span>
            )}
          </div>
        </div>
      </div>

      {!saved && (
        <div className="flex gap-[6px] mt-[10px]">
          {[
            { id: "conducted", tone: "moss", label: "Провёл" },
            { id: "cancelled_by_student", tone: "terracotta", label: "Отменён" },
            { id: "penalty", tone: "crimson", label: "Штраф" },
          ].map((b) => (
            <button
              key={b.id}
              type="button"
              disabled={pending}
              onClick={() => quick(b.id as LessonStatus)}
              className={cn(
                "flex-1 bg-parchment rounded-[10px] py-2 text-[13px] font-medium disabled:opacity-50",
                b.tone === "moss" && "text-moss",
                b.tone === "terracotta" && "text-terracotta",
                b.tone === "crimson" && "text-crimson",
              )}
              style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}

      {saved && (
        <p className="text-[12px] text-olive mt-2 px-1">
          Сохранено: {LESSON_STATUS_LABEL[saved]}
        </p>
      )}
      {error && <p className="text-[12px] text-crimson mt-2 px-1">{error}</p>}
    </div>
  );
}
