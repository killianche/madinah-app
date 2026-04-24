import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import {
  findTeacherByUserId,
  findActiveTeachers,
} from "@/lib/repos/teachers";
import {
  findStudentById,
  getStudentTeacherBreakdown,
} from "@/lib/repos/students";
import { listLessonsForStudent } from "@/lib/repos/lessons";
import { listTopupsForStudent } from "@/lib/repos/topups";
import { listSchedulesForStudent } from "@/lib/repos/schedules";
import { LESSON_STATUS_LABEL, type LessonStatus } from "@/lib/types";
import { ScheduleEditor } from "./schedule-editor";
import { TeacherBreakdown } from "./teacher-breakdown";
import { ChangeTeacherDialog } from "./change-teacher-dialog";

export const metadata = { title: "Ученик — Madinah" };

const STATUS_VARIANT: Record<LessonStatus, "success" | "terracotta" | "olive"> = {
  conducted: "success",
  penalty: "terracotta",
  cancelled_by_teacher: "olive",
  cancelled_by_student: "olive",
};

const PRIVILEGED_ROLES = ["manager", "curator", "admin", "director"] as const;

export default async function StudentCard({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await requireAuth();
  const { id } = await params;

  const student = await findStudentById(id);
  if (!student) notFound();

  const isPrivileged = (PRIVILEGED_ROLES as readonly string[]).includes(
    auth.user.role,
  );

  // Учитель видит только своих учеников. Остальные — любого.
  if (!isPrivileged) {
    const ownTeacher = await findTeacherByUserId(auth.user.id);
    if (!ownTeacher || student.teacher_id !== ownTeacher.id) notFound();
  }

  const canChangeTeacher = auth.user.role === "manager"
    || auth.user.role === "curator"
    || auth.user.role === "admin";

  const [lessons, topups, schedules, breakdown, activeTeachers] =
    await Promise.all([
      listLessonsForStudent(student.id),
      listTopupsForStudent(student.id),
      listSchedulesForStudent(student.id),
      getStudentTeacherBreakdown(student.id, student.teacher_id),
      canChangeTeacher ? findActiveTeachers() : Promise.resolve([]),
    ]);

  return (
    <AppShell
      title={student.full_name}
      back={
        isPrivileged
          ? { href: "/manager", label: "Ученики" }
          : { href: "/teacher", label: "Мои ученики" }
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="card">
          <p className="text-sm text-olive-gray">Баланс</p>
          <p className="font-serif text-4xl mt-1 tabular-nums">
            {Math.max(student.balance, 0)}
          </p>
          {student.balance < 0 && (
            <p className="text-xs text-terracotta mt-1">
              фактически {student.balance}
            </p>
          )}
          <p className="text-xs text-olive-gray mt-3">
            Учитель: {student.teacher_name ?? "не назначен"}
          </p>
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
            {canChangeTeacher && (
              <ChangeTeacherDialog
                studentId={student.id}
                currentTeacherId={student.teacher_id}
                teachers={activeTeachers.map((t) => ({
                  id: t.id,
                  full_name: t.full_name,
                }))}
              />
            )}
          </div>
          {student.is_charity && (
            <div className="mt-3">
              <Badge variant="olive">Благотворительный</Badge>
            </div>
          )}
        </div>
      </div>

      <div className="mb-8">
        <TeacherBreakdown
          stats={breakdown}
          currentTeacherId={student.teacher_id}
        />
      </div>

      <div className="mb-8">
        <h2 className="mb-4">Расписание</h2>
        <ScheduleEditor studentId={student.id} initial={schedules} />
      </div>

      <div className="mb-8">
        <h2 className="mb-4">История уроков</h2>
        {lessons.length === 0 ? (
          <div className="card text-olive-gray">Уроков ещё не было.</div>
        ) : (
          <ul className="space-y-2">
            {lessons.map((l) => (
              <li
                key={l.id}
                className="bg-ivory rounded-md shadow-ring p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium flex items-center gap-2">
                    {new Date(l.lesson_date).toLocaleDateString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                    {l.off_schedule && (
                      <Badge variant="olive">
                        план{" "}
                        {new Date(l.scheduled_date).toLocaleDateString(
                          "ru-RU",
                          { day: "2-digit", month: "2-digit" },
                        )}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-olive-gray">{l.teacher_name}</div>
                </div>
                <Badge variant={STATUS_VARIANT[l.status]}>
                  {LESSON_STATUS_LABEL[l.status]}
                </Badge>
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
              <li
                key={t.id}
                className="bg-ivory rounded-md shadow-ring p-3 flex items-center justify-between"
              >
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
