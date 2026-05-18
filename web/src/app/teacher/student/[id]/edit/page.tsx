import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { findStudentById } from "@/lib/repos/students";
import { EditStudentForm } from "./form";

export const metadata = { title: "Редактировать ученика — Madinah" };
export const dynamic = "force-dynamic";

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("manager", "curator", "head", "admin");
  const { id } = await params;
  const student = await findStudentById(id);
  if (!student) notFound();

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
          is_charity: student.is_charity,
          charity_note: student.charity_note,
        }}
      />
    </AppShell>
  );
}
