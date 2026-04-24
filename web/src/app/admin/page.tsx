import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { listAllUsers } from "@/lib/repos/users";
import { UserRow } from "./user-row";

export const metadata = { title: "Сотрудники — Madinah" };
export const dynamic = "force-dynamic";

export default async function AdminHome() {
  await requireRole("admin");
  const users = await listAllUsers();

  return (
    <AppShell title="Сотрудники">
      <div className="flex justify-between items-center mb-5">
        <p className="text-[13px] text-stone">{users.length} всего</p>
        <Link
          href="/admin/users/new"
          className="inline-flex items-center gap-2 bg-terracotta text-ivory font-medium rounded-[12px] px-4 py-[10px] no-underline"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Создать</span>
        </Link>
      </div>

      <ul className="space-y-2">
        {users.map((u) => (
          <UserRow
            key={u.id}
            user={{
              id: u.id,
              full_name: u.full_name,
              role: u.role,
              phone: u.phone,
              email: u.email,
              is_active: u.is_active,
              last_login_at: u.last_login_at,
            }}
          />
        ))}
      </ul>
    </AppShell>
  );
}
