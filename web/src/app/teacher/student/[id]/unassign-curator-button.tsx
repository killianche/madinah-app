"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { unassignStudentByCuratorAction } from "./actions";

/**
 * «Открепить от учителя» для куратора/head/admin. Двухшаговое подтверждение.
 * После открепления ученик уходит в «без учителя» — его можно назначить заново.
 */
export function UnassignCuratorButton({ studentId }: { studentId: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handle() {
    setError(null);
    startTransition(async () => {
      const res = await unassignStudentByCuratorAction(studentId);
      if (res.ok) {
        setConfirm(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (!confirm) {
    return (
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="inline-flex items-center gap-2 px-4 py-[10px] rounded-[12px] font-medium"
        style={{ background: "rgba(181,51,51,0.10)", color: "#b53333" }}
      >
        Открепить от учителя
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handle}
        disabled={pending}
        className="px-4 py-[10px] rounded-[12px] font-medium text-ivory disabled:opacity-50"
        style={{ background: "#b53333" }}
      >
        {pending ? "…" : "Точно открепить"}
      </button>
      <button
        type="button"
        onClick={() => setConfirm(false)}
        className="text-[13px] text-stone px-2"
      >
        Отмена
      </button>
      {error && <span className="text-[12px] text-crimson">{error}</span>}
    </span>
  );
}
