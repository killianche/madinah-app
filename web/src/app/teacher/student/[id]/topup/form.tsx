"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { topupAction } from "./actions";
import { cn } from "@/lib/cn";

const QUICK = [5, 10, 20, 30];

export function TopupForm({
  studentId,
  currentBalance,
  actorName,
}: {
  studentId: string;
  currentBalance: number;
  actorName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [lessons, setLessons] = useState(10);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    if (!lessons || lessons === 0) {
      setError("Выбери количество уроков");
      return;
    }
    startTransition(async () => {
      const result = await topupAction({
        student_id: studentId,
        lessons_added: lessons,
        reason: null,
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
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <div className="text-[11px] uppercase tracking-[0.6px] font-medium text-stone mb-2">
          Количество уроков
        </div>
        <div className="grid grid-cols-4 gap-2">
          {QUICK.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setLessons(n)}
              className={cn(
                "rounded-[12px] py-4 font-serif text-[22px] font-medium tabular-nums transition-[background,box-shadow]",
                lessons === n
                  ? "bg-terracotta text-ivory"
                  : "bg-ivory text-near-black",
              )}
              style={
                lessons === n
                  ? { boxShadow: "0 0 0 1px #c96442" }
                  : { boxShadow: "inset 0 0 0 1px #f0eee6" }
              }
            >
              +{n}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <input
            type="number"
            value={lessons}
            onChange={(e) => setLessons(parseInt(e.target.value, 10) || 0)}
            placeholder="или своё число"
            className="w-full bg-ivory rounded-[12px] px-4 py-3 text-[17px] tabular-nums text-near-black focus:outline-none"
            style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
          />
        </div>
      </div>

      <div
        className="bg-ivory rounded-[14px] p-4 flex items-center justify-between"
        style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
      >
        <div>
          <div className="text-[12px] text-olive">После пополнения</div>
          <div className="font-serif text-[28px] font-medium tabular-nums mt-1 leading-none">
            {currentBalance + lessons}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[12px] text-olive">Принял оплату</div>
          <div className="text-[14px] font-medium mt-1">{actorName}</div>
        </div>
      </div>

      {error && <p className="text-sm text-crimson">{error}</p>}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 bg-terracotta text-ivory font-medium rounded-[12px] py-[14px] disabled:opacity-40"
        >
          {pending ? "Сохраняю…" : `Пополнить +${lessons}`}
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
