"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { claimStudentAction } from "./actions";

export function ClaimButton({
  studentId,
  alreadyMine,
}: {
  studentId: string;
  alreadyMine: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (alreadyMine) {
    return (
      <span className="text-[11px] text-stone/70">· у вас</span>
    );
  }

  function claim() {
    setError(null);
    startTransition(async () => {
      const res = await claimStudentAction(studentId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={claim}
        disabled={pending}
        className="text-[11px] text-terracotta hover:underline disabled:opacity-50"
      >
        {pending ? "…" : "привязать к себе"}
      </button>
      {error && <span className="text-[11px] text-crimson">{error}</span>}
    </span>
  );
}
