"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { editLessonAction, deleteLessonAction } from "./actions";

const STATUSES = [
  { value: "conducted", label: "Провёл (списывает с баланса)" },
  { value: "penalty", label: "Штраф (списывает с баланса)" },
  { value: "cancelled_by_student", label: "Отменил ученик (без списания)" },
  { value: "cancelled_by_teacher", label: "Отменил учитель (без списания)" },
] as const;

export function EditLessonForm({
  lessonId,
  studentId,
  canDelete,
  initial,
}: {
  lessonId: string;
  studentId: string;
  canDelete: boolean;
  initial: {
    lesson_date: string;
    lesson_time: string;
    status: string;
    topic: string;
    notes: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [confirmDel, setConfirmDel] = useState(false);

  const [date, setDate] = useState(initial.lesson_date);
  const [status, setStatus] = useState(initial.status);
  const [topic, setTopic] = useState(initial.topic);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const res = await editLessonAction({
        lesson_id: lessonId,
        lesson_date: date,
        lesson_time: null,
        status: status as never,
        topic: topic || null,
        notes: null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/teacher/student/${studentId}`);
      router.refresh();
    });
  }

  function doDelete() {
    setError(undefined);
    startTransition(async () => {
      const res = await deleteLessonAction({ lesson_id: lessonId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/teacher/student/${studentId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Дата урока">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </Field>

      <Field label="Статус">
        <select
          className="input"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Тема">
        <Input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="например: Алиф-Ба, урок 5"
        />
      </Field>

      {error && <p className="text-sm text-terracotta">{error}</p>}

      <div className="flex gap-3 items-center flex-wrap">
        <Button type="submit" disabled={pending}>
          {pending ? "Сохраняю…" : "Сохранить"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Отмена
        </Button>
        <div className="ml-auto">
          {!confirmDel ? (
            <button
              type="button"
              onClick={() => setConfirmDel(true)}
              className="text-[13px] font-medium text-crimson px-3 py-2 rounded-[10px]"
              style={{ boxShadow: "inset 0 0 0 1px rgba(181,51,51,0.35)" }}
            >
              Удалить урок
            </button>
          ) : (
            <div className="inline-flex gap-2 items-center">
              <span className="text-[12px] text-stone">точно удалить?</span>
              <button
                type="button"
                disabled={pending}
                onClick={doDelete}
                className="text-[13px] font-medium px-3 py-2 rounded-[10px] bg-crimson text-ivory disabled:opacity-40"
              >
                Да, удалить
              </button>
              <button
                type="button"
                onClick={() => setConfirmDel(false)}
                className="text-[13px] text-stone px-2"
              >
                Нет
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="text-[11px] text-stone">
        При смене статуса баланс ученика автоматически корректируется (если новый статус
        списывает, а старый нет — снимется 1 урок, и наоборот).
      </p>
    </form>
  );
}
