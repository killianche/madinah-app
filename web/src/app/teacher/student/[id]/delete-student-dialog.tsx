"use client";

import { useState, useTransition } from "react";
import { deleteStudentAction } from "./actions";

export function DeleteStudentDialog({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(undefined);
    startTransition(async () => {
      const res = await deleteStudentAction(studentId);
      if (res && !res.ok) {
        setError(res.error);
      }
      // On success deleteStudentAction redirects — no further action needed.
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-[10px] rounded-[12px] font-medium text-crimson no-underline"
        style={{ boxShadow: "inset 0 0 0 1px rgba(185,28,28,0.25)" }}
      >
        Удалить ученика
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-near-black/40 flex items-center justify-center p-4 z-50"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="bg-ivory rounded-[18px] shadow-ring w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-2xl leading-tight">
              Удалить ученика?
            </h3>
            <p className="text-[14px] text-olive leading-relaxed">
              <span className="font-medium text-near-black">{studentName}</span> будет
              скрыт из всех списков. История уроков и баланса сохранится в базе.
            </p>
            <p className="text-[13px] text-crimson font-medium">
              Действие необратимо.
            </p>

            {error && (
              <p className="text-[13px] text-crimson">{error}</p>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="px-4 py-[10px] rounded-[12px] font-medium text-charcoal"
                style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="px-4 py-[10px] rounded-[12px] font-medium text-ivory bg-crimson disabled:opacity-50"
              >
                {pending ? "Удаляю…" : "Удалить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
