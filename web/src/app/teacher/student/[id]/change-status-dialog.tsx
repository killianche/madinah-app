"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { StudentStatus } from "@/lib/types";
import { STUDENT_STATUS_LABEL } from "@/lib/types";
import { changeStatusAction } from "./actions";

const STATUSES: {
  value: StudentStatus;
  label: string;
  helper: string;
}[] = [
  { value: "active", label: "Обучается", helper: "видим везде, по умолчанию" },
  { value: "paused", label: "В отпуске", helper: "временно, вернётся — не в «Сегодня», но виден в Учениках" },
  { value: "graduated", label: "Выпускник", helper: "закончил успешно — фильтр «Выпускники» в Учениках" },
  { value: "dropped", label: "Бросил", helper: "прекратил обучение — фильтр «Бросили» в Учениках" },
  { value: "archived", label: "Архив", helper: "прочие причины — фильтр «Архив» в Учениках" },
];

export function ChangeStatusDialog({
  studentId,
  currentStatus,
}: {
  studentId: string;
  currentStatus: StudentStatus;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<StudentStatus>(currentStatus);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  function close() {
    setOpen(false);
    setSelected(currentStatus);
    setReason("");
    setError(undefined);
  }

  function submit() {
    if (selected === currentStatus) {
      setError("Это уже текущий статус");
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const res = await changeStatusAction({
        student_id: studentId,
        new_status: selected,
        reason: reason.trim() || null,
      });
      if (res.ok) {
        close();
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary"
      >
        Статус: {STUDENT_STATUS_LABEL[currentStatus]}
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-near-black/40 flex items-center justify-center p-4 z-50"
          onClick={close}
        >
          <div
            className="bg-ivory rounded-lg shadow-ring w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-2xl">Статус ученика</h3>

            <div className="space-y-2">
              {STATUSES.map((s) => (
                <label
                  key={s.value}
                  className={`flex items-start gap-3 p-3 rounded-md cursor-pointer transition-colors ${
                    selected === s.value
                      ? "bg-terracotta-soft shadow-ring-strong"
                      : "hover:bg-subtle/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="status"
                    value={s.value}
                    checked={selected === s.value}
                    onChange={() => setSelected(s.value)}
                    className="mt-1 accent-terracotta"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">
                      {s.label}
                      {s.value === currentStatus && (
                        <span className="text-xs text-olive-gray ml-2">· текущий</span>
                      )}
                    </div>
                    <div className="text-xs text-olive-gray">{s.helper}</div>
                  </div>
                </label>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Причина <span className="text-olive-gray">(необязательно)</span>
              </label>
              <textarea
                className="input"
                rows={2}
                maxLength={500}
                placeholder="например: попросил родитель"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-terracotta">{error}</p>}

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={close}
                className="btn-secondary"
                disabled={pending}
              >
                Отмена
              </button>
              <Button
                onClick={submit}
                disabled={pending || selected === currentStatus}
              >
                {pending ? "Меняю…" : "Подтвердить"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
