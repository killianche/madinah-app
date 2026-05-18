"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Chip } from "@/components/ui/chip";
import { assignTeacherAction } from "./actions";

interface ScheduleSlot {
  weekday: number;
  time_at: string;
}

interface Student {
  id: string;
  full_name: string;
  phone: string | null;
  balance: number;
  created_by_name: string | null;
  days_unassigned: number;
  schedule: ScheduleSlot[];
}

interface Teacher {
  id: string;
  full_name: string;
}

const DAY_SHORT = ["", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];

function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

function sortSlots(slots: ScheduleSlot[]): ScheduleSlot[] {
  return [...slots].sort((a, b) => {
    if (a.weekday !== b.weekday) return a.weekday - b.weekday;
    return a.time_at.localeCompare(b.time_at);
  });
}

export function UnassignedList({
  students,
  teachers,
}: {
  students: Student[];
  teachers: Teacher[];
}) {
  const router = useRouter();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pick(studentId: string, teacherId: string) {
    setError(null);
    startTransition(async () => {
      const result = await assignTeacherAction({ student_id: studentId, teacher_id: teacherId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpenFor(null);
      router.refresh();
    });
  }

  return (
    <div
      className="bg-ivory rounded-[14px] px-4"
      style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
    >
      {students.map((s, i) => {
        const isOpen = openFor === s.id;
        const slots = sortSlots(s.schedule);
        return (
          <div key={s.id} className={i > 0 ? "border-t border-border-cream" : ""}>
            <div className="grid grid-cols-[1fr_auto] items-start gap-3 py-[14px]">
              <div className="min-w-0">
                <Link
                  href={`/teacher/student/${s.id}`}
                  className="text-[15px] font-medium truncate text-near-black no-underline hover:underline"
                >
                  {s.full_name}
                </Link>
                <div className="text-[12px] text-olive tabular-nums mt-0.5 truncate">
                  {s.phone ? `${s.phone} · ` : ""}
                  баланс {s.balance}
                  {" · "}
                  {s.days_unassigned} {plural(s.days_unassigned, ["день", "дня", "дней"])} без учителя
                  {s.created_by_name ? ` · добавил ${s.created_by_name}` : ""}
                </div>
                {/* Расписание */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {slots.length > 0 ? (
                    slots.map((sl, idx) => (
                      <span
                        key={idx}
                        className="text-[11px] tabular-nums px-2 py-[3px] rounded-[8px] bg-warm-sand text-charcoal"
                      >
                        {DAY_SHORT[sl.weekday]} {sl.time_at.slice(0, 5)}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-stone italic">расписание не задано</span>
                  )}
                  <Link
                    href={`/teacher/student/${s.id}`}
                    className="text-[11px] text-terracotta no-underline hover:underline"
                  >
                    {slots.length > 0 ? "править" : "добавить"} →
                  </Link>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <Link
                  href={`/teacher/student/${s.id}/edit`}
                  className="text-[12px] font-medium text-charcoal px-3 py-2 rounded-[10px] no-underline"
                  style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
                >
                  Редактировать
                </Link>
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/manager/teachers/match?student=${s.id}`}
                    className="text-[12px] font-medium text-charcoal px-3 py-2 rounded-[10px] no-underline"
                    style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
                  >
                    Подобрать
                  </Link>
                  <button
                    type="button"
                    onClick={() => setOpenFor(isOpen ? null : s.id)}
                    className="text-[12px] font-medium text-terracotta px-3 py-2 rounded-[10px]"
                    style={{ boxShadow: isOpen ? "inset 0 0 0 1px #c96442" : "inset 0 0 0 1px #e8e6dc" }}
                    disabled={pending}
                  >
                    {isOpen ? "Закрыть" : "Назначить"}
                  </button>
                </div>
              </div>
            </div>
            {isOpen && (
              <div className="pb-3 -mt-1">
                <div className="text-[11px] uppercase tracking-[0.6px] font-medium text-stone mb-2">
                  Выбери учителя
                </div>
                {teachers.length === 0 ? (
                  <div className="text-[13px] text-olive">Нет активных учителей.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {teachers.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        disabled={pending}
                        onClick={() => pick(s.id, t.id)}
                        className="text-[13px] px-3 py-2 rounded-[10px] bg-ivory text-near-black disabled:opacity-50"
                        style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
                      >
                        {t.full_name}
                      </button>
                    ))}
                  </div>
                )}
                {error && (
                  <div className="mt-2">
                    <Chip tone="bad" size="s">{error}</Chip>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
