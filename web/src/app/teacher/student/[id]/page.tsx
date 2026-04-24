import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { findTeacherByUserId } from "@/lib/repos/teachers";
import { findStudentById } from "@/lib/repos/students";
import { listLessonsForStudent } from "@/lib/repos/lessons";
import { listTopupsForStudent } from "@/lib/repos/topups";
import { LESSON_STATUS_LABEL, type LessonStatus } from "@/lib/types";

export const metadata = { title: "Ученик — Madinah" };

const STATUS_VARIANT: Record<LessonStatus, "success" | "terracotta" | "olive"> = {
  conducted: "success",
  penalty: "terracotta",
  cancelled_by_teacher: "olive",
  cancelled_by_student: "olive",
};

export default async function StudentCard({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireRole("teacher");
  const { id } = await params;

  const teacher = await findTeacherByUserId(user.id);
  if (!teacher) notFound();

  const student = await findStudentById(id);
  if (!student) notFound();
  if (student.teacher_id !== teacher.id) notFound();

  const [lessons, topups] = await Promise.all([
    listLessonsForStudent(student.id),
    listTopupsForStudent(student.id),
  ]);

  return (
    <AppShell title={student.full_name} back={{ href: "/teacher", label: "Мои ученики" }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="card">
          <p className="text-sm text-olive-gray">Баланс</p>
          <p className="font-serif text-4xl mt-1 tabular-nums">
            {Math.max(student.balance, 0)}
          </p>
          {student.balance < 0 && (
            <p className="text-xs text-terracotta mt-1">фактически {student.balance}</p>
          )}
        </div>
        <div className="card">
          <p className="text-sm text-olive-gray mb-2">Действия</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/teacher/lesson/new?student=${student.id}`}
              className="btn-primary no-underline"
            >
              Записать урок
            </Link>
            <Link
              href={`/teacher/student/${student.id}/topup`}
              className="btn-secondary no-underline"
            >
              Пополнить баланс
            </Link>
          </div>
          {student.is_charity && (
            <div className="mt-3">
              <Badge variant="olive">Благотворительный</Badge>
            </div>
          )}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="mb-4">История уроков</h2>
        {lessons.length === 0 ? (
          <div className="card text-olive-gray">Уроков ещё не было.</div>
        ) : (
          <ul className="space-y-2">
            {lessons.map((l) => (
              <li key={l.id} className="bg-ivory rounded-md shadow-ring p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {new Date(l.lesson_date).toLocaleDateString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </div>
                  <div className="text-xs text-olive-gray">{l.teacher_name}</div>
                </div>
                <Badge variant={STATUS_VARIANT[l.status]}>{LESSON_STATUS_LABEL[l.status]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>

      {topups.length > 0 && (
        <div>
          <h2 className="mb-4">Пополнения</h2>
          <ul className="space-y-2">
            {topups.map((t) => (
              <li key={t.id} className="bg-ivory rounded-md shadow-ring p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {t.lessons_added > 0 ? "+" : ""}
                    {t.lessons_added} уроков
                  </div>
                  <div className="text-xs text-olive-gray">
                    {new Date(t.created_at).toLocaleDateString("ru-RU")} ·{" "}
                    {t.added_by_name ?? "—"}
                    {t.reason ? ` · ${t.reason}` : ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AppShell>
  );
}
