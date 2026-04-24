"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import type { LessonStatus } from "@/lib/types";
import { LESSON_STATUS_LABEL } from "@/lib/types";
import { createLessonAction } from "./actions";
import { cn } from "@/lib/cn";

const STATUSES: LessonStatus[] = ["conducted", "penalty", "cancelled_by_teacher", "cancelled_by_student"];
const DEDUCT_HINTS: Record<LessonStatus, string> = {
  conducted: "−1 с баланса",
  penalty: "−1 с баланса (ученик не пришёл)",
  cancelled_by_teacher: "баланс не трогаем",
  cancelled_by_student: "баланс не трогаем",
};

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
  const [studentId, setStudentId] = useState(defaultStudentId ?? students[0]?.id ?? "");
  const today = new Date().toISOString().slice(0, 10);
  const [lessonDate, setLessonDate] = useState(defaultDate ?? today);
  const [lessonTime, setLessonTime] = useState<string>("");
  const [status, setStatus] = useState<LessonStatus>("conducted");
  const [topic, setTopic] = useState("");

  const selected = students.find((s) => s.id === studentId);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await createLessonAction({
        student_id: studentId,
        lesson_date: lessonDate,
        lesson_time: lessonTime || null,
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
    <form onSubmit={onSubmit} className="space-y-6">
      <Field label="Ученик">
        <select
          className="input"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          required
        >
          {students.length === 0 && <option value="">— нет учеников —</option>}
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · баланс {Math.max(s.balance, 0)}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Дата проведения">
          <Input
            type="date"
            value={lessonDate}
            onChange={(e) => setLessonDate(e.target.value)}
            required
          />
        </Field>
        <Field label="Время (необязательно)">
          <Input
            type="time"
            value={lessonTime}
            onChange={(e) => setLessonTime(e.target.value)}
          />
        </Field>
      </div>

      <fieldset className="space-y-2">
        <legend className="label">Статус урока</legend>
        {STATUSES.map((st) => (
          <label
            key={st}
            className={cn(
              "flex items-start gap-3 p-3 rounded-md cursor-pointer transition-colors",
              status === st ? "bg-terracotta-soft shadow-ring-strong" : "hover:bg-subtle/40",
            )}
          >
            <input
              type="radio"
              name="status"
              value={st}
              checked={status === st}
              onChange={() => setStatus(st)}
              className="mt-1 accent-terracotta"
            />
            <div className="flex-1">
              <div className="text-sm font-medium">{LESSON_STATUS_LABEL[st]}</div>
              <div className="text-xs text-olive-gray">{DEDUCT_HINTS[st]}</div>
            </div>
          </label>
        ))}
      </fieldset>

      <Field label="Тема (необязательно)">
        <Input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="например, «Сура аль-Фатиха»"
          maxLength={200}
        />
      </Field>

      {error && <p className="text-sm text-terracotta">{error}</p>}

      {selected && (
        <div className="text-sm text-olive-gray bg-subtle/40 rounded-md p-3">
          После записи баланс {selected.name}:{" "}
          <span className="font-medium text-near-black">
            {["conducted", "penalty"].includes(status) ? selected.balance - 1 : selected.balance}
          </span>
        </div>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending || !studentId}>
          {pending ? "Сохраняю…" : "Сохранить урок"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
