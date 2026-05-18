import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { findTeacherByUserId } from "@/lib/repos/teachers";
import { teacherStudentListWithFormer } from "@/lib/repos/students";
import { StudentsList } from "./list-client";

export const metadata = { title: "Мои ученики — Madinah" };
export const dynamic = "force-dynamic";

export default async function TeacherStudents() {
  const { user } = await requireRole("teacher");
  const teacher = await findTeacherByUserId(user.id);
  if (!teacher) notFound();

  const students = await teacherStudentListWithFormer(teacher.id);
  const currentCount = students.filter((s) => s.is_current).length;
  const formerCount = students.length - currentCount;

  return (
    <AppShell title="Мои ученики">
      <p className="text-[13px] text-stone mb-3">
        {currentCount} {currentCount === 1 ? "ученик" : "учеников"}
        {formerCount > 0 && ` · ${formerCount} переданы другим`}
      </p>
      <StudentsList students={students} />
    </AppShell>
  );
}
