import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { listAllUsers } from "@/lib/repos/users";
import { Badge } from "@/components/ui/badge";
import { USER_ROLE_LABEL } from "@/lib/types";

export const metadata = { title: "Администрирование — Madinah" };

export default async function AdminHome() {
  await requireRole("admin");
  const users = await listAllUsers();

  return (
    <AppShell title="Сотрудники">
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-olive-gray">{users.length} всего</p>
        <Link href="/admin/users/new" className="btn-primary no-underline">
          Создать сотрудника
        </Link>
      </div>

      <ul className="space-y-2">
        {users.map((u) => (
          <li
            key={u.id}
            className="bg-ivory rounded-md shadow-ring p-4 flex items-center justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{u.full_name}</span>
                {!u.is_active && <Badge variant="olive">Деактивирован</Badge>}
              </div>
              <div className="text-sm text-olive-gray mt-0.5">
                {USER_ROLE_LABEL[u.role]}
                {u.phone ? ` · ${u.phone}` : ""}
                {u.email ? ` · ${u.email}` : ""}
              </div>
            </div>
            <div className="text-right text-xs text-olive-gray">
              {u.last_login_at
                ? `вошёл ${new Date(u.last_login_at).toLocaleDateString("ru-RU")}`
                : "ни разу не входил"}
            </div>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
