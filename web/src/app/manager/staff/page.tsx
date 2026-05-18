import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { listAllUsers } from "@/lib/repos/users";
import { USER_ROLE_LABEL, type UserRole } from "@/lib/types";
import { ToggleStaffButton } from "./toggle-button";

export const metadata = { title: "Сотрудники — Madinah" };
export const dynamic = "force-dynamic";

const ROLE_TONE: Record<UserRole, string> = {
  admin: "text-crimson bg-[rgba(181,51,51,0.10)]",
  curator: "text-moss bg-[rgba(63,107,61,0.10)]",
  head: "text-moss bg-[rgba(63,107,61,0.10)]",
  manager: "text-[#c89c6a] bg-[rgba(200,156,106,0.16)]",
  teacher: "text-stone bg-[#e8e6dc]",
};

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export default async function StaffPage() {
  const { user } = await requireRole("head", "admin");
  const allUsers = await listAllUsers();
  // Менеджеры работают в Sales (op.appmadinah.ru), здесь они только identity для created_by_user_id.
  // Поэтому скрываем их из списка сотрудников Quran.
  let users = allUsers.filter((u) => u.role !== "manager");
  // Руководитель не видит админов — разделение уровней доступа.
  if (user.role === "head") users = users.filter((u) => u.role !== "admin");
  return (
    <AppShell title="Сотрудники">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-[12px] text-olive tabular-nums">
          {users.length} всего, {users.filter((u) => u.is_active).length} активных
        </p>
        <Link
          href="/manager/staff/new"
          className="text-[13px] font-medium px-3 py-1.5 rounded-[8px] bg-terracotta text-ivory no-underline"
        >
          + Создать
        </Link>
      </div>

      <ul className="space-y-2">
        {users.map((u) => (
          <li
            key={u.id}
            className="bg-ivory rounded-[14px] p-3"
            style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
          >
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[14px] font-medium ${
                      u.is_active ? "text-near-black" : "text-stone"
                    }`}
                  >
                    {u.full_name}
                  </span>
                  <span
                    className={`inline-block text-[10px] uppercase tracking-[0.4px] px-1.5 py-0.5 rounded font-medium ${
                      ROLE_TONE[u.role]
                    }`}
                  >
                    {USER_ROLE_LABEL[u.role]}
                  </span>
                  {!u.is_active && (
                    <span className="text-[10px] uppercase tracking-[0.4px] font-medium text-crimson bg-[rgba(181,51,51,0.10)] px-1.5 py-0.5 rounded">
                      выкл.
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-olive mt-1 tabular-nums">
                  {u.login ?? "—"}
                  {u.phone && <span className="text-stone"> · {u.phone}</span>}
                </div>
                <div className="text-[11px] text-stone mt-0.5 tabular-nums">
                  Был: {fmtDate(u.last_login_at)}
                </div>
              </div>
              <ToggleStaffButton userId={u.id} isActive={u.is_active} />
            </div>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
