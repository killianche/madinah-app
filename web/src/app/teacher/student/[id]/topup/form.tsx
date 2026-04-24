"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { topupAction } from "./actions";

export function TopupForm({ studentId, currentBalance }: { studentId: string; currentBalance: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [lessons, setLessons] = useState("10");
  const [reason, setReason] = useState("");

  const lessonsNum = parseInt(lessons, 10);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    if (isNaN(lessonsNum) || lessonsNum === 0) {
      setError("Количество уроков должно быть ненулевым числом");
      return;
    }
    startTransition(async () => {
      const result = await topupAction({
        student_id: studentId,
        lessons_added: lessonsNum,
        reason: reason.trim() || null,
      });
      if (result.ok) {
        router.push(`/teacher/student/${studentId}`);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex gap-2">
        {[5, 10, 20, 30].map((n) => (
          <button
            key={n}
            type="button"
            className="btn-secondary"
            onClick={() => setLessons(String(n))}
          >
            +{n}
          </button>
        ))}
      </div>

      <Field label="Количество уроков" helper="Можно отрицательное число для корректировки">
        <Input
          type="number"
          value={lessons}
          onChange={(e) => setLessons(e.target.value)}
          required
        />
      </Field>

      <Field label="Комментарий (необязательно)">
        <Input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="например, «оплата за апрель»"
          maxLength={200}
        />
      </Field>

      {error && <p className="text-sm text-terracotta">{error}</p>}

      {!isNaN(lessonsNum) && lessonsNum !== 0 && (
        <p className="text-sm text-olive-gray">
          После пополнения:{" "}
          <span className="font-medium text-near-black">
            {currentBalance + lessonsNum}
          </span>
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Сохраняю…" : "Пополнить"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
