"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adjustAction } from "./actions";

export function AdjustForm({
  studentId,
  currentBalance,
}: {
  studentId: string;
  currentBalance: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [rawDelta, setRawDelta] = useState("");
  const [reason, setReason] = useState("");

  const delta = parseInt(rawDelta, 10);
  const validDelta = !Number.isNaN(delta) && delta !== 0;
  const newBalance = validDelta ? currentBalance + delta : null;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    if (!validDelta) {
      setError("Введите ненулевое число (можно отрицательное)");
      return;
    }
    if (!reason.trim()) {
      setError("Укажите причину коррекции");
      return;
    }
    startTransition(async () => {
      const result = await adjustAction({
        student_id: studentId,
        delta,
        reason: reason.trim(),
      });
      if (result.ok) {
        router.push(`/teacher/student/${studentId}`);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  const btnLabel = validDelta
    ? `Скорректировать ${delta > 0 ? `+${delta}` : delta}`
    : "Скорректировать";

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <div className="text-[11px] uppercase tracking-[0.6px] font-medium text-stone mb-2">
          Изменение баланса
        </div>
        <input
          type="number"
          value={rawDelta}
          onChange={(e) => setRawDelta(e.target.value)}
          placeholder="например −3 или +2"
          className="w-full bg-ivory rounded-[12px] px-4 py-3 text-[17px] tabular-nums text-near-black focus:outline-none"
          style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
          autoFocus
        />
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-[0.6px] font-medium text-stone mb-2">
          Причина <span className="text-crimson">*</span>
        </div>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Исправление ошибки при пополнении"
          maxLength={200}
          className="w-full bg-ivory rounded-[12px] px-4 py-3 text-[15px] text-near-black focus:outline-none"
          style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
        />
      </div>

      <div
        className="bg-ivory rounded-[14px] p-4 flex items-center justify-between"
        style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
      >
        <div>
          <div className="text-[12px] text-olive">Баланс после</div>
          <div
            className={`font-serif text-[28px] font-medium tabular-nums mt-1 leading-none ${
              newBalance !== null && newBalance <= 0 ? "text-crimson" : "text-near-black"
            }`}
          >
            {newBalance !== null ? newBalance : "—"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[12px] text-olive">Сейчас</div>
          <div className="font-serif text-[22px] font-medium tabular-nums mt-1">
            {currentBalance}
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-crimson">{error}</p>}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={pending || !validDelta || !reason.trim()}
          className="flex-1 bg-terracotta text-ivory font-medium rounded-[12px] py-[14px] disabled:opacity-40"
        >
          {pending ? "Сохраняю…" : btnLabel}
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
    </form>
  );
}
