import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { findActiveTeachers } from "@/lib/repos/teachers";
import { NewStaffForm } from "../new-form";

export const metadata = { title: "Новый сотрудник — Madinah" };
export const dynamic = "force-dynamic";

export default async function NewStaffPage() {
  const { user } = await requireRole("head", "admin");
  const teachers = await findActiveTeachers();
  return (
    <AppShell
      title="Новый сотрудник"
      back={{ href: "/manager/staff", label: "Сотрудники" }}
    >
      <div
        className="bg-ivory rounded-[14px] p-4"
        style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
      >
        <NewStaffForm
          allowAdmin={user.role === "admin"}
          teachers={teachers
            .filter((t) => !t.user_id)
            .map((t) => ({ id: t.id, name: t.full_name }))}
        />
      </div>
    </AppShell>
  );
}
