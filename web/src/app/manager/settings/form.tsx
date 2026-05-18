"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveGlobalRatesAction } from "./actions";

export function GlobalRatesForm({
  initial,
}: {
  initial: { rate_conducted: number; rate_penalty: number };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [conducted, setConducted] = useState<string>(String(initial.rate_conducted));
  const [penalty, setPenalty] = useState<string>(String(initial.rate_penalty));
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const c = parseFloat(conducted);
    const p = parseFloat(penalty);
    if (isNaN(c) || c < 0 || isNaN(p) || p < 0) {
      setError("Неверное число");
      setState("error");
      return;
    }
    startTransition(async () => {
      const r = await saveGlobalRatesAction({
        rate_conducted: c,
        rate_penalty: p,
      });
      if (r.ok) {
        setState("saved");
        router.refresh();
        setTimeout(() => setState("idle"), 1500);
      } else {
        setError(r.error);
        setState("error");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <div className="text-[11px] uppercase tracking-[0.6px] font-medium text-stone mb-1">
          Ставка за «провёл», ₽
        </div>
        <input
          className="input w-full tabular-nums"
          type="number"
          step="1"
          min="0"
          value={conducted}
          onChange={(e) => setConducted(e.target.value)}
          required
        />
      </label>

      <label className="block">
        <div className="text-[11px] uppercase tracking-[0.6px] font-medium text-stone mb-1">
          Ставка за «штраф», ₽
        </div>
        <input
          className="input w-full tabular-nums"
          type="number"
          step="1"
          min="0"
          value={penalty}
          onChange={(e) => setPenalty(e.target.value)}
          required
        />
        <div className="text-[11px] text-olive mt-1">
          Штраф = ученик не пришёл, но урок «прошёл» по балансу. Обычно меньше провёл.
        </div>
      </label>

      {error && <p className="text-[13px] text-crimson">{error}</p>}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="text-[14px] font-medium px-4 py-2 rounded-[10px] bg-terracotta text-ivory disabled:opacity-40"
        >
          {pending ? "Сохраняю…" : "Сохранить"}
        </button>
        {state === "saved" && (
          <span className="text-[12px] text-moss">Сохранено</span>
        )}
      </div>
    </form>
  );
}
