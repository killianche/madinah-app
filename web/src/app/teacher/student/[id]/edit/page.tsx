import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { findStudentById, assertTeacherOwnsStudent } from "@/lib/repos/students";
import { EditStudentForm } from "./form";

export const metadata = { title: "Редактировать ученика — Madinah" };
export const dynamic = "force-dynamic";

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireAuth();
  const { id } = await params;
  const student = await findStudentById(id);
  if (!student) notFound();

  // Учитель может редактировать только своего ученика. Остальные роли — любого.
  if (user.role === "teacher") {
    try {
      await assertTeacherOwnsStudent(user.id, id);
    } catch {
      notFound();
    }
  }

  return (
    <AppShell
      title="Редактировать"
      back={{ href: `/teacher/student/${student.id}`, label: student.full_name }}
    >
      <EditStudentForm
        id={student.id}
        initial={{
          full_name: student.full_name,
          phone: student.phone,
          telegram_username: student.telegram_username,
          telegram_phone: student.telegram_phone,
          whatsapp_phone: student.whatsapp_phone,
          is_charity: student.is_charity,
          charity_note: student.charity_note,
        }}
      />
    </AppShell>
  );
}
