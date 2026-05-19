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
  getLastTeacherChangeNote,
  getStudentTeacherHistory,
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
import { ScheduleEditClient } from "./schedule-edit-client";
import { DeleteStudentDialog } from "./delete-student-dialog";
import { ClaimButton } from "./claim-button";
import { UnassignSelfButton } from "./unassign-self-button";

export const metadata = { title: "Ученик — Madinah" };

const PRIVILEGED_ROLES = ["manager", "curator", "head", "admin"] as const;

const STATUS_TONE: Record<StudentStatus, "good" | "warn" | "bad" | "neutral"> = {
  active: "good",
  paused: "warn",
  graduated: "neutral",
  dropped: "bad",
  closed: "neutral",
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

  const ownTeacher =
    auth.user.role === "teacher" ? await findTeacherByUserId(auth.user.id) : null;
  if (!isPrivileged) {
    if (!ownTeacher || student.teacher_id !== ownTeacher.id) notFound();
  }

  const isManager = auth.user.role === "manager";
  const canChangeTeacher =
    auth.user.role === "curator" ||
    auth.user.role === "head" ||
    auth.user.role === "admin";
  const canEdit = canChangeTeacher; // менеджер только смотрит
  const canDelete = auth.user.role === "head" || auth.user.role === "admin";

  const [
    lessons,
    topups,
    schedules,
    breakdown,
    activeTeachers,
    statusHistory,
    attention,
    lastTeacherNote,
    teacherHistory,
  ] = await Promise.all([
    listLessonsForStudent(student.id, 500),
    listTopupsForStudent(student.id),
    listSchedulesForStudent(student.id),
    getStudentTeacherBreakdown(student.id, student.teacher_id),
    canChangeTeacher ? findActiveTeachers() : Promise.resolve([]),
    getStudentStatusHistory(student.id),
    getStudentAttention(student.id),
    getLastTeacherChangeNote(student.id),
    isPrivileged ? getStudentTeacherHistory(student.id) : Promise.resolve([]),
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
  const enrolledAt = student.enrolled_at;
  const firstLessonDate = breakdown.length
    ? breakdown
        .map((r) => r.first_lesson_date)
        .reduce((a, b) => (new Date(a) < new Date(b) ? a : b))
    : null;
  const lastLessonDate = lessons[0]?.lesson_date ?? null;

  const initialName = student.full_name.replace(/[\+\d\s\-\(\)]+$/g, "").trim() || student.full_name;
  const phone = student.phone;
  const tg = student.telegram_username;
  const tgPhone = student.telegram_phone;
  const wa = student.whatsapp_phone;
  const isTeacherRole = auth.user.role === "teacher";
  const creatorName = student.creator_name ?? null;

  const balance = student.balance;
  const balanceColor = balance <= 0 ? "text-crimson" : "text-near-black";
  const totalTopups = topups.reduce((s, t) => s + (t.lessons_added > 0 ? t.lessons_added : 0), 0);

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
              {enrolledAt ? `Поступил ${fmtDate(enrolledAt)} · ` : firstLessonDate ? `С ${fmtDate(firstLessonDate)} · ` : ""}
              {daysAgoText(lastLessonDate)}
            </div>
          </div>
        </div>

        {/* Contacts */}
        {(phone || tg || tgPhone) && (
          <div className="flex gap-2 mt-[14px] flex-wrap">
            {phone && (
              <a
                href={`tel:${phone.replace(/[\s\-\(\)]/g, "")}`}
                className="flex-1 min-w-[140px] inline-flex items-center gap-2 bg-parchment rounded-[10px] px-3 py-[10px] text-[14px] font-medium text-charcoal no-underline tabular-nums"
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
                className="flex-1 min-w-[140px] inline-flex items-center gap-2 bg-parchment rounded-[10px] px-3 py-[10px] text-[14px] font-medium text-charcoal no-underline"
                style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                <span className="truncate">@{tg.replace(/^@/, "")}</span>
              </a>
            )}
            {tgPhone && (
              <a
                href={`https://t.me/+${tgPhone.replace(/[^\d]/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 min-w-[140px] inline-flex items-center gap-2 bg-parchment rounded-[10px] px-3 py-[10px] text-[14px] font-medium text-charcoal no-underline tabular-nums"
                style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                <span className="truncate">TG · {tgPhone}</span>
              </a>
            )}
            {wa && (
              <a
                href={`https://wa.me/${wa.replace(/[^\d]/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 min-w-[140px] inline-flex items-center gap-2 rounded-[10px] px-3 py-[10px] text-[14px] font-medium no-underline tabular-nums"
                style={{ background: "#e7f5ea", color: "#1f7a3a", boxShadow: "inset 0 0 0 1px #c8e6d0" }}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                  <path d="M20.52 3.48A11.94 11.94 0 0 0 12.05 0C5.55 0 .26 5.29.26 11.79c0 2.08.54 4.11 1.57 5.9L0 24l6.47-1.7a11.78 11.78 0 0 0 5.58 1.42h.01c6.5 0 11.79-5.29 11.79-11.79 0-3.15-1.23-6.11-3.33-8.45zM12.06 21.7h-.01a9.83 9.83 0 0 1-5.01-1.37l-.36-.21-3.84 1.01 1.03-3.74-.24-.39a9.85 9.85 0 0 1-1.51-5.21c0-5.43 4.42-9.85 9.86-9.85 2.63 0 5.1 1.03 6.97 2.89a9.81 9.81 0 0 1 2.88 6.96c0 5.43-4.42 9.85-9.85 9.85zm5.4-7.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.66.15-.2.3-.76.96-.93 1.16-.17.2-.34.22-.64.07-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.34.45-.51.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.66-1.6-.91-2.18-.24-.57-.49-.5-.66-.5-.17-.01-.37-.01-.57-.01-.2 0-.5.07-.77.37-.27.3-1.02.99-1.02 2.42 0 1.43 1.04 2.81 1.19 3.01.15.2 2.05 3.13 4.97 4.39.69.3 1.24.48 1.66.61.7.22 1.33.19 1.83.12.56-.08 1.75-.71 2-1.4.25-.69.25-1.28.17-1.4-.07-.13-.27-.2-.57-.35z"/>
                </svg>
                <span className="truncate">WhatsApp</span>
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

      {/* PREV TEACHER NOTE — Д2/П5 */}
      {lastTeacherNote && lastTeacherNote.reason && (
        <section className="bg-warm-sand rounded-[14px] p-4 mb-[14px]">
          <div className="text-[11px] uppercase tracking-[0.6px] font-medium text-stone mb-1">
            Заметка при смене учителя · {fmtDate(lastTeacherNote.changed_at)}
          </div>
          <div className="text-[13px] text-near-black">{lastTeacherNote.reason}</div>
          {(lastTeacherNote.old_teacher_name || lastTeacherNote.new_teacher_name) && (
            <div className="text-[11px] text-olive mt-1">
              {lastTeacherNote.old_teacher_name ?? "?"} → {lastTeacherNote.new_teacher_name ?? "?"}
              {lastTeacherNote.actor_name ? ` · ${lastTeacherNote.actor_name}` : ""}
            </div>
          )}
        </section>
      )}

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
          {totalTopups > 0 && (
            <div className="text-[11px] text-olive mt-0.5 tabular-nums">
              внесено всего {totalTopups}
            </div>
          )}
          <Link
            href={`/teacher/student/${student.id}/adjust`}
            className="inline-block mt-2 text-[12px] font-medium text-terracotta no-underline"
          >
            Скорректировать →
          </Link>
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

      {/* ACTIONS grid — только если есть права */}
      {!isManager && (
        <div
          className={`grid gap-2 mb-[22px] ${isTeacherRole ? "grid-cols-3" : "grid-cols-2"}`}
        >
          {isTeacherRole && (
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
          )}
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
      )}

      {(canChangeTeacher || isTeacherRole) && (
        <div className="mb-[22px] flex flex-wrap gap-2">
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
          <Link
            href={`/teacher/student/${student.id}/edit`}
            className="inline-flex items-center gap-2 px-4 py-[10px] rounded-[12px] font-medium text-charcoal no-underline"
            style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
          >
            Редактировать профиль
          </Link>
          {canDelete && (
            <DeleteStudentDialog
              studentId={student.id}
              studentName={initialName}
            />
          )}
          {isTeacherRole &&
            ownTeacher &&
            student.teacher_id === ownTeacher.id && (
              <UnassignSelfButton
                studentId={student.id}
                studentName={initialName}
              />
            )}
        </div>
      )}

      {/* SCHEDULE — decorative + edit */}
      <section className="mb-[22px]">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone">
            Расписание · напоминание
          </div>
          {(canEdit || isTeacherRole) && (
            <ScheduleEditClient
              studentId={student.id}
              initialSlots={schedules
                .filter((s) => s.active)
                .map((s) => ({ weekday: s.weekday, time_at: s.time_at }))}
            />
          )}
        </div>
        {schedules.filter((s) => s.active).length > 0 ? (
          <WeekStrip
            slots={schedules
              .filter((s) => s.active)
              .map((s) => ({ weekday: s.weekday, time_at: s.time_at }))}
          />
        ) : (
          <div
            className="bg-ivory rounded-[14px] py-6 text-center"
            style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
          >
            <p className="text-olive text-[13px]">Расписание не задано.</p>
          </div>
        )}
      </section>

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

      {/* TEACHER CHANGE HISTORY (curators+) — П7 */}
      {isPrivileged && teacherHistory.length > 0 && (
        <section className="mb-[22px]">
          <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mb-3">
            Смены учителя · {teacherHistory.length}
          </div>
          <div className="bg-ivory rounded-[14px] overflow-hidden" style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}>
            {teacherHistory.map((h, i) => (
              <div key={i} className={`p-3 ${i > 0 ? "border-t border-[#ece9dd]" : ""}`}>
                <div className="text-[11px] uppercase tracking-[0.6px] font-medium text-stone tabular-nums">
                  {fmtDate(h.changed_at)} · {h.actor_name ?? "—"}
                </div>
                <div className="text-[13px] text-near-black mt-0.5">
                  {h.old_teacher_name ?? "—"} → {h.new_teacher_name ?? "—"}
                </div>
                {h.reason && (
                  <div className="text-[12px] text-olive mt-1">{h.reason}</div>
                )}
              </div>
            ))}
          </div>
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
          <LessonHistory
            lessons={lessonsForHistory}
            canEdit={canEdit || isTeacherRole}
            // Учителю — только его последний урок с этим учеником.
            // Куратору+ — undefined = все доступны.
            editableLessonIds={
              isTeacherRole && ownTeacher
                ? (() => {
                    const myLessons = lessons.filter(
                      (l) => l.teacher_id === ownTeacher.id,
                    );
                    // Последний по lesson_date (история отсортирована desc — берём первый матч).
                    const last = myLessons[0];
                    return last ? [last.id] : [];
                  })()
                : undefined
            }
          />
        </section>
      )}

      {/* TOPUPS */}
      {topups.length > 0 && (
        <section>
          <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mb-3">
            История баланса
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
                  className="w-10 h-10 rounded-full flex items-center justify-center font-medium text-[13px] shrink-0"
                  style={
                    t.lessons_added > 0
                      ? { background: "rgba(63,107,61,0.10)", color: "#3f6b3d" }
                      : { background: "rgba(185,28,28,0.08)", color: "#b91c1c" }
                  }
                >
                  {t.lessons_added > 0 ? `+${t.lessons_added}` : t.lessons_added}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium">
                    {t.reason ?? (t.lessons_added > 0 ? "Пополнение" : "Коррекция")}
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

      {/* Создатель (менеджер) — мелким, в самом низу */}
      <div className="mt-6 text-center text-[11px] text-stone/70 flex items-center justify-center gap-2 flex-wrap">
        {creatorName ? (
          <>
            <span>Менеджер: {creatorName}</span>
            {(auth.user.role === "manager" ||
              auth.user.role === "curator" ||
              auth.user.role === "head" ||
              auth.user.role === "admin") && (
              <ClaimButton
                studentId={student.id}
                alreadyMine={student.created_by_user_id === auth.user.id}
              />
            )}
          </>
        ) : (
          (auth.user.role === "manager" ||
            auth.user.role === "curator" ||
            auth.user.role === "head" ||
            auth.user.role === "admin") && (
            <>
              <span>Менеджер не назначен</span>
              <ClaimButton studentId={student.id} alreadyMine={false} />
            </>
          )
        )}
      </div>
    </AppShell>
  );
}
