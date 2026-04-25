import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { Chip } from "@/components/ui/chip";
import { Avatar } from "@/components/ui/avatar";
import { WeekStrip } from "@/components/ui/week-strip";
import { Donut } from "@/components/ui/donut";
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
  STUDENT_STATUS_LABEL,
  type StudentStatus,
} from "@/lib/types";
import { TeacherBreakdown } from "./teacher-breakdown";
import { ChangeTeacherDialog } from "./change-teacher-dialog";
import { ChangeStatusDialog } from "./change-status-dialog";
import { LessonHistory, type LessonRow } from "./lesson-history";

export const metadata = { title: "Ученик — Madinah" };

const PRIVILEGED_ROLES = ["manager", "curator", "head", "admin", "director"] as const;

const STATUS_TONE: Record<StudentStatus, "good" | "warn" | "bad" | "neutral"> = {
  active: "good",
  paused: "warn",
  graduated: "neutral",
  dropped: "bad",
  archived: "neutral",
};

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function daysAgoText(d: Date | null): string {
  if (!d) return "ещё не было уроков";
  const n = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (n === 0) return "последний урок сегодня";
  if (n === 1) return "последний урок вчера";
  return `последний урок ${n} дн. назад`;
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
    auth.user.role === "head" ||
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
    listLessonsForStudent(student.id, 500),
    listTopupsForStudent(student.id),
    listSchedulesForStudent(student.id),
    getStudentTeacherBreakdown(student.id, student.teacher_id),
    canChangeTeacher ? findActiveTeachers() : Promise.resolve([]),
    getStudentStatusHistory(student.id),
    getStudentAttention(student.id),
  ]);

  // Метрики: total = conducted + penalty (основные, списанные с баланса).
  // Отмены — считаем отдельно.
  const conducted = breakdown.reduce((s, r) => s + r.conducted, 0);
  const penalty = breakdown.reduce((s, r) => s + r.penalty, 0);
  const cancelledAll = breakdown.reduce(
    (s, r) => s + r.cancelled_by_student + r.cancelled_by_teacher,
    0,
  );
  const total = conducted + penalty;
  // Посещаемость = conducted / (conducted + penalty + cancelled_by_student).
  // Отмена учителем не вина ученика.
  const attendanceBase =
    conducted + penalty + breakdown.reduce((s, r) => s + r.cancelled_by_student, 0);
  const attendance =
    attendanceBase > 0 ? Math.round((conducted / attendanceBase) * 100) : null;
  const firstDate = breakdown.length
    ? breakdown
        .map((r) => r.first_lesson_date)
        .reduce((a, b) => (new Date(a) < new Date(b) ? a : b))
    : null;
  const lastLessonDate = lessons[0]?.lesson_date ?? null;

  const initialName = student.full_name.replace(/[\+\d\s\-\(\)]+$/g, "").trim() || student.full_name;
  const phone = student.phone;
  const tg = student.telegram_username;

  const balance = student.balance;
  const balanceColor = balance <= 0 ? "text-crimson" : "text-near-black";

  const lessonsForHistory: LessonRow[] = lessons.map((l) => ({
    id: l.id,
    lesson_date: l.lesson_date,
    status: l.status,
    teacher_name: l.teacher_name,
    topic: l.topic ?? null,
    ordinal: l.ordinal,
  }));

  return (
    <AppShell
      title="Ученик"
      back={
        isPrivileged
          ? { href: "/manager", label: "Ученики" }
          : { href: "/teacher/students", label: "Мои ученики" }
      }
    >
      {/* HERO */}
      <section
        className="bg-ivory rounded-[18px] p-5 mb-[14px]"
        style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
      >
        <div className="flex items-center gap-[14px]">
          <Avatar name={initialName} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-serif text-[26px] font-medium leading-tight tracking-[-0.3px]">
                {initialName}
              </h1>
              {student.status === "active" &&
              (attention?.kind === "stale" || attention?.kind === "skipping") ? (
                <Chip tone="neutral" size="s">
                  Серая зона
                </Chip>
              ) : (
                <Chip tone={STATUS_TONE[student.status]} size="s">
                  {STUDENT_STATUS_LABEL[student.status]}
                </Chip>
              )}
            </div>
            <div className="text-[13px] text-olive mt-1">
              {firstDate ? `С ${fmtDate(firstDate)} · ` : ""}
              {daysAgoText(lastLessonDate)}
            </div>
          </div>
        </div>

        {/* Contacts */}
        {(phone || tg) && (
          <div className="flex gap-2 mt-[14px]">
            {phone && (
              <a
                href={`tel:${phone.replace(/[\s\-\(\)]/g, "")}`}
                className="flex-1 inline-flex items-center gap-2 bg-parchment rounded-[10px] px-3 py-[10px] text-[14px] font-medium text-charcoal no-underline tabular-nums"
                style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                <span className="truncate">{phone}</span>
              </a>
            )}
            {tg && (
              <a
                href={`https://t.me/${tg.replace(/^@/, "")}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 inline-flex items-center gap-2 bg-parchment rounded-[10px] px-3 py-[10px] text-[14px] font-medium text-charcoal no-underline"
                style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                <span className="truncate">@{tg.replace(/^@/, "")}</span>
              </a>
            )}
          </div>
        )}

        {/* Grey zone warning */}
        {attention?.kind === "stale" && (
          <div className="mt-3">
            <Chip tone="warn" size="m">давно не было уроков</Chip>
          </div>
        )}
        {attention?.kind === "skipping" && (
          <div className="mt-3">
            <Chip tone="warn" size="m">3 пропуска подряд</Chip>
          </div>
        )}
      </section>

      {/* METRICS 2x2 */}
      <div className="grid grid-cols-2 gap-[10px] mb-[14px]">
        {/* Посещаемость */}
        <div className="bg-ivory rounded-[14px] shadow-ring p-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.6px] text-stone mb-2">
            Посещаемость
          </div>
          {attendance !== null ? (
            <div className="flex items-center gap-3">
              <Donut pct={attendance / 100} size={44} />
              <div>
                <div className="font-serif text-[24px] font-medium leading-none tabular-nums">
                  {attendance}%
                </div>
                <div className="text-[11px] text-olive mt-1 tabular-nums">
                  {conducted} из {total}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-[13px] text-olive">—</div>
          )}
        </div>

        {/* Баланс */}
        <div className="bg-ivory rounded-[14px] shadow-ring p-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.6px] text-stone mb-2">
            Баланс
          </div>
          <div className={`font-serif text-[34px] font-medium leading-none tabular-nums ${balanceColor}`}>
            {balance}
          </div>
          <div className="text-[11px] text-olive mt-1">уроков осталось</div>
        </div>

        {/* Засчитано (conducted + penalty) */}
        <div className="bg-ivory rounded-[14px] shadow-ring p-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.6px] text-stone mb-2">
            Засчитано
          </div>
          <div className="font-serif text-[26px] font-medium leading-none tabular-nums">
            {total}
          </div>
          <div className="text-[11px] text-olive mt-1 tabular-nums">
            {conducted} провёл{penalty > 0 && ` · ${penalty} штраф`}
          </div>
          {cancelledAll > 0 && (
            <div className="mt-2">
              <Chip tone="amber" size="s">отм. {cancelledAll}</Chip>
            </div>
          )}
        </div>

        {/* Текущий учитель */}
        <div className="bg-ivory rounded-[14px] shadow-ring p-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.6px] text-stone mb-2">
            Учитель
          </div>
          <div className="font-serif text-[22px] font-medium leading-tight tracking-[-0.2px]">
            {student.teacher_name ?? "—"}
          </div>
          <div className="text-[11px] text-olive mt-1">текущий</div>
        </div>
      </div>

      {/* ACTIONS grid */}
      <div className="grid grid-cols-3 gap-2 mb-[22px]">
        <Link
          href={`/teacher/lesson/new?student=${student.id}`}
          className="inline-flex flex-col items-center justify-center gap-1 bg-terracotta text-ivory rounded-[12px] py-3 no-underline font-medium text-[13px]"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Записать</span>
        </Link>
        <Link
          href={`/teacher/student/${student.id}/topup`}
          className="inline-flex flex-col items-center justify-center gap-1 bg-ivory rounded-[12px] py-3 no-underline font-medium text-[13px] text-charcoal"
          style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 12V8H6a2 2 0 0 1 0-4h12v4" />
            <path d="M4 6v12a2 2 0 0 0 2 2h14v-4" />
            <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
          </svg>
          <span>Пополнить</span>
        </Link>
        <ChangeStatusDialog
          studentId={student.id}
          currentStatus={student.status}
        />
      </div>

      {canChangeTeacher && (
        <div className="mb-[22px] flex flex-wrap gap-2">
          <ChangeTeacherDialog
            studentId={student.id}
            currentTeacherId={student.teacher_id}
            teachers={activeTeachers.map((t) => ({
              id: t.id,
              full_name: t.full_name,
            }))}
          />
          <Link
            href={`/teacher/student/${student.id}/edit`}
            className="inline-flex items-center gap-2 px-4 py-[10px] rounded-[12px] font-medium text-charcoal no-underline"
            style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
          >
            Редактировать профиль
          </Link>
        </div>
      )}

      {/* SCHEDULE — decorative */}
      {schedules.length > 0 && (
        <section className="mb-[22px]">
          <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mb-2">
            Расписание · напоминание
          </div>
          <WeekStrip
            slots={schedules
              .filter((s) => s.active)
              .map((s) => ({ weekday: s.weekday, time_at: s.time_at }))}
          />
        </section>
      )}

      {/* TEACHER HISTORY */}
      {breakdown.length > 0 && (
        <section className="mb-[22px]">
          <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mb-3">
            История по учителям
          </div>
          <TeacherBreakdown
            stats={breakdown}
            currentTeacherId={student.teacher_id}
          />
        </section>
      )}

      {/* STATUS HISTORY */}
      {statusHistory.length > 0 && (
        <section className="mb-[22px]">
          <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mb-3">
            История статуса
          </div>
          <ul className="space-y-2">
            {statusHistory.map((h, i) => (
              <li
                key={i}
                className="bg-ivory rounded-[14px] shadow-ring p-3"
              >
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[12px] text-olive tabular-nums">
                    {new Date(h.created_at).toLocaleDateString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </span>
                  <span className="text-[14px]">
                    {h.old_status ? STUDENT_STATUS_LABEL[h.old_status] : "—"}
                    <span className="text-olive mx-1">→</span>
                    <span className="font-medium">
                      {STUDENT_STATUS_LABEL[h.new_status]}
                    </span>
                  </span>
                </div>
                {(h.actor_name || h.reason) && (
                  <div className="text-[12px] text-olive mt-1">
                    {h.actor_name ?? "—"}
                    {h.reason ? ` · ${h.reason}` : ""}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* LESSON HISTORY with filters + #N */}
      {lessons.length > 0 && (
        <section className="mb-[22px]">
          <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mb-3">
            История уроков
          </div>
          <LessonHistory lessons={lessonsForHistory} />
        </section>
      )}

      {/* TOPUPS */}
      {topups.length > 0 && (
        <section>
          <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mb-3">
            Пополнения
          </div>
          <div className="bg-ivory rounded-[14px] shadow-ring px-4">
            {topups.map((t, i) => (
              <div
                key={t.id}
                className={`flex items-center gap-3 py-3 ${
                  i > 0 ? "border-t border-border-cream" : ""
                }`}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-medium text-[13px]"
                  style={{
                    background: "rgba(63,107,61,0.10)",
                    color: "#3f6b3d",
                  }}
                >
                  +{t.lessons_added}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium">
                    {t.reason ?? "Пополнение"}
                  </div>
                  <div className="text-[12px] text-olive tabular-nums">
                    {t.added_by_name ?? "—"} ·{" "}
                    {new Date(t.created_at).toLocaleDateString("ru-RU")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
