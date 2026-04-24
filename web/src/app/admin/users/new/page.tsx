import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { findActiveTeachers } from "@/lib/repos/teachers";
import { NewUserForm } from "./form";

export const metadata = { title: "Новый сотрудник — Madinah" };

export default async function NewUserPage() {
  await requireRole("admin");
  const teachers = await findActiveTeachers();
  return (
    <AppShell title="Новый сотрудник" back={{ href: "/admin", label: "Сотрудники" }}>
      <div className="card">
        <NewUserForm
          teachers={teachers
            .filter((t) => !t.user_id) // только те, у кого ещё нет логина
            .map((t) => ({ id: t.id, name: t.full_name }))}
        />
      </div>
    </AppShell>
  );
}
