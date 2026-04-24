import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { findTeacherByUserId } from "@/lib/repos/teachers";
import { teacherStudentList } from "@/lib/repos/students";
import { StudentsList } from "./list-client";

export const metadata = { title: "Мои ученики — Madinah" };
export const dynamic = "force-dynamic";

export default async function TeacherStudents() {
  const { user } = await requireRole("teacher");
  const teacher = await findTeacherByUserId(user.id);
  if (!teacher) notFound();

  const students = await teacherStudentList(teacher.id);

  return (
    <AppShell title="Мои ученики">
      <p className="text-[13px] text-stone mb-3">{students.length} всего</p>
      <StudentsList students={students} />
    </AppShell>
  );
}
