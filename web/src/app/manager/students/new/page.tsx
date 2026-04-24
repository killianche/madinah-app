import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { findActiveTeachers } from "@/lib/repos/teachers";
import { NewStudentForm } from "./form";

export const metadata = { title: "Новый ученик — Madinah" };

export default async function NewStudentPage() {
  await requireRole("manager", "curator", "director");
  const teachers = await findActiveTeachers();

  return (
    <AppShell title="Новый ученик" back={{ href: "/manager", label: "Ученики" }}>
      <div className="card">
        <NewStudentForm teachers={teachers.map((t) => ({ id: t.id, name: t.full_name }))} />
      </div>
    </AppShell>
  );
}
