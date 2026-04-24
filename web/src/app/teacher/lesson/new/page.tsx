import { requireRole } from "@/lib/auth/session";
import { findTeacherByUserId } from "@/lib/repos/teachers";
import { teacherStudentList } from "@/lib/repos/students";
import { AppShell } from "@/components/app-shell";
import { NewLessonForm } from "./form";

export const metadata = { title: "Новый урок — Madinah" };

export default async function NewLessonPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string; date?: string }>;
}) {
  const { user } = await requireRole("teacher");
  const teacher = await findTeacherByUserId(user.id);

  if (!teacher) {
    return (
      <AppShell title="Новый урок" back={{ href: "/teacher", label: "Мои ученики" }}>
        <div className="card">
          <p className="text-olive-gray">Профиль учителя не настроен.</p>
        </div>
      </AppShell>
    );
  }

  const students = await teacherStudentList(teacher.id);
  const sp = await searchParams;

  return (
    <AppShell title="Записать урок" back={{ href: "/teacher", label: "Мои ученики" }}>
      <div className="card">
        <NewLessonForm
          students={students.map((s) => ({
            id: s.id,
            name: s.full_name,
            balance: s.balance,
          }))}
          defaultStudentId={sp.student}
          defaultDate={sp.date}
        />
      </div>
    </AppShell>
  );
}
