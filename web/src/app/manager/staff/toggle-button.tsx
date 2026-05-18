"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleStaffActiveAction } from "./actions";

export function ToggleStaffButton({
  userId,
  isActive,
}: {
  userId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      await toggleStaffActiveAction({ user_id: userId, active: !isActive });
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      className={`text-[12px] font-medium px-3 py-1.5 rounded-[8px] disabled:opacity-50 ${
        isActive
          ? "text-charcoal bg-ivory"
          : "text-moss bg-ivory"
      }`}
      style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
    >
      {isActive ? "Деактивировать" : "Включить"}
    </button>
  );
}
