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
  getStudentStatusHistory,
  getStudentAttention,
} from "@/lib/repos/students";
import { listLessonsForStudent } from "@/lib/repos/lessons";
import { listTopupsForStudent } from "@/lib/repos/topups";
import { listSchedulesForStudent } from "@/lib/repos/schedules";
import {
  LESSON_STATUS_LABEL,
  STUDENT_STATUS_LABEL,
  type LessonStatus,
  type StudentStatus,
} from "@/lib/types";
import { ScheduleEditor } from "./schedule-editor";
import { TeacherBreakdown } from "./teacher-breakdown";
import { ChangeTeacherDialog } from "./change-teacher-dialog";
import { ChangeStatusDialog } from "./change-status-dialog";

export const metadata = { title: "Ученик — Madinah" };

const STATUS_VARIANT: Record<LessonStatus, "success" | "terracotta" | "olive"> = {
  conducted: "success",
  penalty: "terracotta",
  cancelled_by_teacher: "olive",
  cancelled_by_student: "olive",
};

const STUDENT_STATUS_VARIANT: Record<StudentStatus, "success" | "terracotta" | "olive" | "neutral"> = {
  active: "success",
  paused: "neutral",
  graduated: "olive",
  dropped: "terracotta",
  archived: "olive",
};

const PRIVILEGED_ROLES = ["manager", "curator", "head", "admin", "director"] as const;

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function daysAgo(d: Date): number {
  const ms = Date.now() - new Date(d).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

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

  if (!isPrivileged) {
    const ownTeacher = await findTeacherByUserId(auth.user.id);
    if (!ownTeacher || student.teacher_id !== ownTeacher.id) notFound();
  }

  const canChangeTeacher =
    auth.user.role === "manager" ||
    auth.user.role === "curator" ||
    auth.user.role === "admin";

  const [
    lessons,
    topups,
    schedules,
    breakdown,
    activeTeachers,
    statusHistory,
    attention,
  ] = await Promise.all([
    listLessonsForStudent(student.id),
    listTopupsForStudent(student.id),
    listSchedulesForStudent(student.id),
    getStudentTeacherBreakdown(student.id, student.teacher_id),
    canChangeTeacher ? findActiveTeachers() : Promise.resolve([]),
    getStudentStatusHistory(student.id),
    getStudentAttention(student.id),
  ]);

  // Краткая аналитика
  const total = breakdown.reduce((s, r) => s + r.total, 0);
  const conducted = breakdown.reduce((s, r) => s + r.conducted, 0);
  const penalty = breakdown.reduce((s, r) => s + r.penalty, 0);
  const cancelled = breakdown.reduce(
    (s, r) => s + r.cancelled_by_student + r.cancelled_by_teacher,
    0,
  );
  const firstDate = breakdown.length
    ? breakdown
        .map((r) => r.first_lesson_date)
        .reduce((a, b) => (new Date(a) < new Date(b) ? a : b))
    : null;
  const lastLesson = lessons[0];
  const lastDaysAgo = lastLesson ? daysAgo(lastLesson.lesson_date) : null;

  return (
    <AppShell
      title={student.full_name}
      back={
        isPrivileged
          ? { href: "/manager", label: "Ученики" }
          : { href: "/teacher", label: "Мои ученики" }
      }
    >
      {/* Краткая аналитика */}
      {total > 0 && (
        <div className="mb-6 text-sm text-olive-gray flex flex-wrap gap-x-4 gap-y-1">
          <span>
            Всего уроков:{" "}
            <span className="font-medium text-near-black tabular-nums">
              {total}
            </span>
          </span>
          <span>
            Проведено:{" "}
            <span className="font-medium text-near-black tabular-nums">
              {conducted}
            </span>
          </span>
          {penalty > 0 && (
            <span>
              Штраф:{" "}
              <span className="font-medium text-near-black tabular-nums">
                {penalty}
              </span>
            </span>
          )}
          {cancelled > 0 && (
            <span>
              Отменено:{" "}
              <span className="font-medium text-near-black tabular-nums">
                {cancelled}
              </span>
            </span>
          )}
          {firstDate && <span>С {fmtDate(firstDate)}</span>}
          {lastDaysAgo !== null && (
            <span>
              Последний:{" "}
              {lastDaysAgo === 0
                ? "сегодня"
                : lastDaysAgo === 1
                  ? "вчера"
                  : `${lastDaysAgo} дн. назад`}
            </span>
          )}
        </div>
      )}

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
          <div className="text-xs text-olive-gray mt-3 flex items-center gap-2 flex-wrap">
            <span>Учитель: {student.teacher_name ?? "не назначен"}</span>
            <Badge variant={STUDENT_STATUS_VARIANT[student.status]}>
              {STUDENT_STATUS_LABEL[student.status]}
            </Badge>
            {attention?.kind === "stale" && (
              <Badge variant="warning">давно не было уроков</Badge>
            )}
            {attention?.kind === "skipping" && (
              <Badge variant="warning">3 пропуска подряд</Badge>
            )}
          </div>
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
            <ChangeStatusDialog
              studentId={student.id}
              currentStatus={student.status}
            />
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

      {statusHistory.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4">История статуса</h2>
          <ul className="space-y-2">
            {statusHistory.map((h, i) => (
              <li
                key={i}
                className="bg-ivory rounded-md shadow-ring p-3"
              >
                <div className="text-sm flex items-baseline gap-2 flex-wrap">
                  <span className="text-olive-gray tabular-nums">
                    {new Date(h.created_at).toLocaleDateString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </span>
                  <span>
                    {h.old_status
                      ? STUDENT_STATUS_LABEL[h.old_status]
                      : "—"}{" "}
                    →{" "}
                    <span className="font-medium">
                      {STUDENT_STATUS_LABEL[h.new_status]}
                    </span>
                  </span>
                </div>
                <div className="text-xs text-olive-gray mt-1">
                  {h.actor_name ?? "—"}
                  {h.reason ? ` · ${h.reason}` : ""}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

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
                  <div className="text-sm font-medium">
                    {fmtDate(l.lesson_date)}
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
