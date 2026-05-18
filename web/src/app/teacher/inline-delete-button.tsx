"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteLessonAction } from "./lesson/[id]/edit/actions";

/**
 * Inline-кнопка удаления последнего урока учителя — на главной (Сегодня).
 * Двух-шаговое подтверждение: «Удалить» → «Точно?» → действие.
 */
export function InlineDeleteButton({ lessonId }: { lessonId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function doDelete() {
    setError(null);
    startTransition(async () => {
      const r = await deleteLessonAction({ lesson_id: lessonId });
      if (!r.ok) {
        setError(r.error);
        setConfirm(false);
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {!confirm ? (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="text-[12px] font-medium text-crimson px-2.5 py-1 rounded-[8px] bg-ivory"
          style={{ boxShadow: "inset 0 0 0 1px rgba(181,51,51,0.30)" }}
        >
          Удалить
        </button>
      ) : (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={doDelete}
            className="text-[12px] font-medium px-2.5 py-1 rounded-[8px] bg-crimson text-ivory disabled:opacity-40"
          >
            {pending ? "..." : "Точно"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirm(false)}
            className="text-[12px] text-stone px-1.5"
          >
            Нет
          </button>
        </>
      )}
      {error && <span className="text-[11px] text-crimson ml-1">{error}</span>}
    </span>
  );
}
