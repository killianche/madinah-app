import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { Chip } from "@/components/ui/chip";
import { findTeacherByUserId } from "@/lib/repos/teachers";
import {
  getTeacherMonthlyStats,
  getTeacherTotalStats,
  getTeacherTopStudents,
  listLessonsForTeacher,
} from "@/lib/repos/lessons";
import { LESSON_STATUS_LABEL, type LessonStatus } from "@/lib/types";

export const metadata = { title: "Статистика — Madinah" };
export const dynamic = "force-dynamic";

const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

function formatMonth(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${MONTHS_RU[date.getMonth()]} ${date.getFullYear()}`;
}

function fmtDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function monthsBetween(d: Date): number {
  const now = new Date();
  return (
    (now.getFullYear() - d.getFullYear()) * 12 +
    (now.getMonth() - d.getMonth())
  );
}

function statusChip(status: LessonStatus) {
  if (status === "conducted") return <Chip tone="good" size="s">проведён</Chip>;
  if (status === "penalty") return <Chip tone="bad" size="s">штраф</Chip>;
  return <Chip tone="warn" size="s">{LESSON_STATUS_LABEL[status]}</Chip>;
}

export default async function TeacherStats() {
  const { user } = await requireRole("teacher");
  const teacher = await findTeacherByUserId(user.id);
  if (!teacher) notFound();

  const [monthly, totals, topStudents, recentLessons] = await Promise.all([
    getTeacherMonthlyStats(teacher.id, 24),
    getTeacherTotalStats(teacher.id),
    getTeacherTopStudents(teacher.id, 10),
    listLessonsForTeacher(teacher.id, 10),
  ]);

  const heroMonth = monthly[0];
  const prevMonth = monthly[1];
  const deltaLessons = heroMonth && prevMonth ? heroMonth.total - prevMonth.total : null;
  const pastMonths = monthly.slice(1, 7);

  const experienceMonths = totals.first_lesson_date
    ? monthsBetween(new Date(totals.first_lesson_date))
    : 0;
  const experienceText = experienceMonths >= 12
    ? `${Math.floor(experienceMonths / 12)} г. ${experienceMonths % 12} мес.`
    : `${experienceMonths} мес.`;

  return (
    <AppShell title="Статистика">
      {/* Hero totals */}
      <section
        className="bg-ivory rounded-[16px] p-5 mb-[22px]"
        style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
      >
        <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mb-3">
          За всё время
        </div>
        <div className="grid grid-cols-2 gap-[14px] pb-[14px] border-b border-border-cream">
          <div>
            <div className="font-serif text-[32px] font-medium leading-none tabular-nums tracking-[-0.4px]">
              {totals.total_lessons}
            </div>
            <div className="text-[13px] text-olive mt-1">уроков</div>
          </div>
          <div>
            <div className="font-serif text-[32px] font-medium leading-none tabular-nums tracking-[-0.4px]">
              {totals.unique_students}
            </div>
            <div className="text-[13px] text-olive mt-1">учеников</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-[6px] mt-[14px]">
          {totals.conducted > 0 && <Chip tone="good">провёл {totals.conducted}</Chip>}
          {totals.penalty > 0 && <Chip tone="bad">штраф {totals.penalty}</Chip>}
          {totals.cancelled > 0 && <Chip tone="warn">отм. {totals.cancelled}</Chip>}
        </div>
        {totals.first_lesson_date && (
          <div className="text-[13px] text-olive mt-3">
            Работает с {fmtDate(totals.first_lesson_date)} · {experienceText}
          </div>
        )}
      </section>

      {/* По месяцам — hero + прошлые */}
      {heroMonth && (
        <section className="mb-[22px]">
          <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mb-3">
            По месяцам
          </div>
          <div
            className="bg-ivory rounded-[16px] p-5 mb-2"
            style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
          >
            <div className="flex justify-between items-baseline mb-[14px]">
              <div className="font-serif text-[22px] font-medium tracking-[-0.2px]">
                {formatMonth(heroMonth.month)}
              </div>
              {deltaLessons !== null && (
                <div
                  className={`text-[12px] font-medium tabular-nums ${
                    deltaLessons > 0 ? "text-moss" : deltaLessons < 0 ? "text-crimson" : "text-stone"
                  }`}
                >
                  {deltaLessons > 0 ? "+" : ""}
                  {deltaLessons} к прошлому
                </div>
              )}
            </div>
            <div
              className="grid grid-cols-2 gap-[14px] pb-[14px]"
              style={{ borderBottom: "1px solid #f0eee6" }}
            >
              <div>
                <div className="font-serif text-[32px] font-medium leading-none tabular-nums tracking-[-0.4px]">
                  {heroMonth.total}
                </div>
                <div className="text-[13px] text-olive mt-1">уроков</div>
              </div>
              <div>
                <div className="font-serif text-[32px] font-medium leading-none tabular-nums tracking-[-0.4px]">
                  {heroMonth.students}
                </div>
                <div className="text-[13px] text-olive mt-1">
                  учеников
                  {heroMonth.new_students > 0 && ` · ${heroMonth.new_students} нов.`}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-[6px] mt-[14px]">
              <Chip tone="good">провёл {heroMonth.conducted}</Chip>
              {heroMonth.penalty > 0 && <Chip tone="bad">штраф {heroMonth.penalty}</Chip>}
              {(heroMonth.cancelled_by_student + heroMonth.cancelled_by_teacher) > 0 && (
                <Chip tone="warn">
                  отм. {heroMonth.cancelled_by_student + heroMonth.cancelled_by_teacher}
                </Chip>
              )}
            </div>
          </div>

          {pastMonths.length > 0 && (
            <div
              className="bg-ivory rounded-[14px] px-4"
              style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
            >
              {pastMonths.map((m, i) => (
                <div
                  key={m.month.toString()}
                  className={`grid grid-cols-[1fr_auto] items-center gap-3 py-[14px] ${
                    i > 0 ? "border-t border-border-cream" : ""
                  }`}
                >
                  <div>
                    <div className="text-[15px] font-medium">{formatMonth(m.month)}</div>
                    <div className="text-[12px] text-olive tabular-nums mt-0.5 flex gap-[10px]">
                      <span>провёл {m.conducted}</span>
                      {m.penalty > 0 && (
                        <>
                          <span>·</span>
                          <span>штраф {m.penalty}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="font-serif text-[20px] font-medium tabular-nums">
                    {m.total}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Топ учеников */}
      {topStudents.length > 0 && (
        <section className="mb-[22px]">
          <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mb-3">
            Лучшие ученики
          </div>
          <div
            className="bg-ivory rounded-[14px] px-4"
            style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
          >
            {topStudents.map((s, i) => (
              <Link
                key={s.student_id}
                href={`/teacher/student/${s.student_id}`}
                className={`grid grid-cols-[32px_1fr_auto] items-center gap-3 py-[14px] no-underline text-near-black ${
                  i > 0 ? "border-t border-border-cream" : ""
                }`}
              >
                <span className="font-serif text-[18px] font-medium tabular-nums text-stone">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-[15px] font-medium truncate">{s.student_name}</div>
                  <div className="text-[12px] text-olive tabular-nums mt-0.5">
                    {s.conducted} проведено · {s.total} всего
                  </div>
                </div>
                <div
                  className={`font-serif text-[20px] font-medium tabular-nums ${
                    s.balance <= 0 ? "text-crimson" : ""
                  }`}
                >
                  {s.balance}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Последние уроки */}
      {recentLessons.length > 0 && (
        <section>
          <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mb-3">
            Последние уроки
          </div>
          <div
            className="bg-ivory rounded-[14px] px-4"
            style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
          >
            {recentLessons.map((l, i) => (
              <Link
                key={l.id}
                href={`/teacher/student/${l.student_id}`}
                className={`grid grid-cols-[1fr_auto] items-center gap-3 py-[14px] no-underline text-near-black ${
                  i > 0 ? "border-t border-border-cream" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="text-[15px] font-medium truncate">{l.student_name}</div>
                  <div className="text-[12px] text-olive tabular-nums mt-0.5">
                    {fmtDate(l.lesson_date)}
                    {l.topic ? ` · ${l.topic}` : ""}
                  </div>
                </div>
                {statusChip(l.status)}
              </Link>
            ))}
          </div>
        </section>
      )}

      {monthly.length === 0 && topStudents.length === 0 && recentLessons.length === 0 && (
        <div
          className="bg-ivory rounded-[14px] py-10 text-center text-olive"
          style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
        >
          Пока уроков не было.
        </div>
      )}
    </AppShell>
  );
}
