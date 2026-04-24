"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { LessonStatus } from "@/lib/types";
import { LESSON_STATUS_LABEL } from "@/lib/types";
import { createLessonAction } from "./actions";
import { cn } from "@/lib/cn";

// Семантика: conducted и penalty списывают; отмена — баланс не трогаем
const STATUSES: {
  id: LessonStatus;
  label: string;
  hint: string;
  tone: "good" | "warn" | "bad";
}[] = [
  { id: "conducted", label: "Провёл", hint: "урок проведён, -1 с баланса", tone: "good" },
  { id: "cancelled_by_student", label: "Отменён учеником", hint: "ученик отменил, баланс не меняем", tone: "warn" },
  { id: "cancelled_by_teacher", label: "Отменён учителем", hint: "учитель отменил, баланс не меняем", tone: "warn" },
  { id: "penalty", label: "Штраф", hint: "урок сгорает, -1 с баланса", tone: "bad" },
];

const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

function prettyDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const yesterday = new Date(today.getTime() - 86400000);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday) return `Сегодня, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
  if (isYesterday) return `Вчера, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`;
}

export function NewLessonForm({
  students,
  defaultStudentId,
  defaultDate,
}: {
  students: { id: string; name: string; balance: number }[];
  defaultStudentId?: string;
  defaultDate?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [studentId, setStudentId] = useState(defaultStudentId ?? "");
  const [studentPickerOpen, setStudentPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [lessonDate, setLessonDate] = useState(defaultDate ?? today);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [status, setStatus] = useState<LessonStatus>("conducted");
  const [topic, setTopic] = useState("");

  const selected = students.find((s) => s.id === studentId);

  const filteredStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.name.toLowerCase().includes(q));
  }, [query, students]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId) {
      setError("Выбери ученика");
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const result = await createLessonAction({
        student_id: studentId,
        lesson_date: lessonDate,
        status,
        topic: topic.trim() || null,
      });
      if (result.ok) {
        router.push("/teacher");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Ученик — кастомный dropdown с поиском */}
      <div>
        <div className="text-[11px] uppercase tracking-[0.6px] font-medium text-stone mb-2">
          Ученик
        </div>
        <button
          type="button"
          onClick={() => setStudentPickerOpen(true)}
          className="w-full bg-ivory rounded-[12px] px-4 py-3 flex items-center justify-between gap-3 text-left"
          style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
        >
          <span
            className={cn(
              "text-[17px] truncate",
              selected ? "text-near-black" : "text-stone",
            )}
          >
            {selected ? selected.name : "Выбери ученика"}
          </span>
          {selected && (
            <span className="text-[13px] text-olive tabular-nums whitespace-nowrap">
              баланс {selected.balance}
            </span>
          )}
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-stone shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* Дата — удобная кнопка */}
      <div>
        <div className="text-[11px] uppercase tracking-[0.6px] font-medium text-stone mb-2">
          Дата
        </div>
        <button
          type="button"
          onClick={() => setDatePickerOpen(true)}
          className="w-full bg-ivory rounded-[12px] px-4 py-3 flex items-center gap-3 text-left"
          style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
        >
          <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] text-charcoal" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="text-[17px] text-near-black first-letter:capitalize">
            {prettyDate(lessonDate)}
          </span>
        </button>
        {datePickerOpen && (
          <input
            type="date"
            autoFocus
            value={lessonDate}
            onChange={(e) => {
              setLessonDate(e.target.value);
              setDatePickerOpen(false);
            }}
            onBlur={() => setDatePickerOpen(false)}
            className="w-full mt-2 bg-ivory rounded-[12px] px-4 py-3 text-[17px] text-near-black"
            style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
          />
        )}
        {!datePickerOpen && lessonDate !== today && (
          <button
            type="button"
            onClick={() => setLessonDate(today)}
            className="text-[12px] text-terracotta mt-2"
          >
            сегодня
          </button>
        )}
      </div>

      {/* Статус — grid 4 карточки */}
      <fieldset>
        <div className="text-[11px] uppercase tracking-[0.6px] font-medium text-stone mb-2">
          Статус урока
        </div>
        <div className="space-y-2">
          {STATUSES.map((s) => (
            <label
              key={s.id}
              className={cn(
                "block rounded-[12px] px-4 py-3 cursor-pointer transition-[background,box-shadow]",
                status === s.id
                  ? s.tone === "good"
                    ? "bg-[rgba(63,107,61,0.10)]"
                    : s.tone === "warn"
                      ? "bg-[rgba(201,100,66,0.10)]"
                      : "bg-[rgba(181,51,51,0.10)]"
                  : "bg-ivory",
              )}
              style={{
                boxShadow:
                  status === s.id
                    ? s.tone === "good"
                      ? "inset 0 0 0 1.5px #3f6b3d"
                      : s.tone === "warn"
                        ? "inset 0 0 0 1.5px #c96442"
                        : "inset 0 0 0 1.5px #b53333"
                    : "inset 0 0 0 1px #f0eee6",
              }}
            >
              <input
                type="radio"
                name="status"
                value={s.id}
                checked={status === s.id}
                onChange={() => setStatus(s.id)}
                className="sr-only"
              />
              <div
                className={cn(
                  "text-[15px] font-medium",
                  status === s.id &&
                    (s.tone === "good"
                      ? "text-moss"
                      : s.tone === "warn"
                        ? "text-terracotta"
                        : "text-crimson"),
                )}
              >
                {s.label}
              </div>
              <div className="text-[12px] text-olive mt-0.5">{s.hint}</div>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Тема */}
      <div>
        <div className="text-[11px] uppercase tracking-[0.6px] font-medium text-stone mb-2">
          Тема
          <span className="text-olive normal-case tracking-normal font-normal ml-1">
            — необязательно
          </span>
        </div>
        <textarea
          rows={3}
          maxLength={200}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Например, «Сура аль-Фатиха»"
          className="w-full bg-ivory rounded-[12px] px-4 py-3 text-[15px] text-near-black placeholder:text-stone resize-none focus:outline-none"
          style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
        />
      </div>

      {error && <p className="text-[14px] text-crimson">{error}</p>}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={pending || !studentId}
          className="flex-1 inline-flex items-center justify-center bg-terracotta text-ivory font-medium rounded-[12px] py-[14px] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? "Сохраняю…" : "Сохранить"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-[14px] rounded-[12px] font-medium text-charcoal"
          style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
        >
          Отмена
        </button>
      </div>

      {/* Модалка выбора ученика */}
      {studentPickerOpen && (
        <div
          className="fixed inset-0 z-50 bg-near-black/40 flex items-end sm:items-center justify-center p-4"
          onClick={() => setStudentPickerOpen(false)}
        >
          <div
            className="bg-ivory rounded-[18px] w-full max-w-md max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border-cream">
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по имени"
                className="w-full bg-parchment rounded-[10px] px-3 py-2.5 text-[15px] text-near-black placeholder:text-stone focus:outline-none"
                style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {filteredStudents.length === 0 ? (
                <div className="p-6 text-center text-olive text-sm">
                  Никого не нашлось
                </div>
              ) : (
                filteredStudents.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setStudentId(s.id);
                      setStudentPickerOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      "w-full px-4 py-3 text-left flex items-center justify-between gap-3 transition-colors",
                      s.id === studentId
                        ? "bg-terracotta-soft"
                        : "hover:bg-parchment",
                    )}
                  >
                    <span className="text-[15px] font-medium truncate">{s.name}</span>
                    <span
                      className={cn(
                        "text-[12px] tabular-nums shrink-0",
                        s.balance <= 0 ? "text-crimson" : "text-olive",
                      )}
                    >
                      {s.balance}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
