"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Chip } from "@/components/ui/chip";
import { useToast } from "@/components/ui/toast";
import { USER_ROLE_LABEL, type UserRole } from "@/lib/types";
import { toggleUserActiveAction } from "./deactivate/actions";

export function UserRow({
  user,
}: {
  user: {
    id: string;
    full_name: string;
    role: UserRole;
    phone: string | null;
    email: string | null;
    is_active: boolean;
    last_login_at: Date | null;
  };
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (!confirm(
      user.is_active
        ? `Деактивировать ${user.full_name}? Все его сессии будут закрыты.`
        : `Активировать ${user.full_name}?`,
    )) return;
    startTransition(async () => {
      const res = await toggleUserActiveAction({
        user_id: user.id,
        active: !user.is_active,
      });
      if (res.ok) {
        toast.success(user.is_active ? "Деактивирован" : "Активирован");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <li className="bg-ivory rounded-[14px] shadow-ring p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{user.full_name}</span>
            {!user.is_active && <Chip tone="bad" size="s">деактивирован</Chip>}
          </div>
          <div className="text-[13px] text-olive mt-0.5 tabular-nums">
            {USER_ROLE_LABEL[user.role]}
            {user.phone ? ` · ${user.phone}` : ""}
            {user.email ? ` · ${user.email}` : ""}
          </div>
          <div className="text-[12px] text-stone mt-1 tabular-nums">
            {user.last_login_at
              ? `вошёл ${new Date(user.last_login_at).toLocaleDateString("ru-RU")}`
              : "ни разу не входил"}
          </div>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className={`px-3 py-2 rounded-[10px] text-[13px] font-medium disabled:opacity-40 ${
            user.is_active ? "text-crimson" : "text-moss"
          }`}
          style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
        >
          {pending ? "..." : user.is_active ? "Деактивировать" : "Активировать"}
        </button>
      </div>
    </li>
  );
}
