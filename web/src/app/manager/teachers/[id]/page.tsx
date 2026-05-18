import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { Chip } from "@/components/ui/chip";
import {
  findTeacherById,
  listTeachersForCurator,
  getTeacherQuality,
  listTeacherStudentsWithFlags,
} from "@/lib/repos/teachers";
import { getTeacherAvailability } from "@/lib/repos/availability";
import {
  listLessonsForTeacher,
  getTeacherWeeklyChart12W,
} from "@/lib/repos/lessons";
import { LESSON_STATUS_LABEL, type LessonStatus } from "@/lib/types";
import { TeacherActions } from "./actions-client";
import { AvailabilityView } from "./availability-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await findTeacherById(id);
  return { title: t ? `${t.full_name} — Madinah` : "Учитель — Madinah" };
}

const STATUS_LABEL = {
  active: "активный",
  paused: "пауза",
  fired: "уволен",
  archived: "архив",
} as const;

const ATTENTION_LABEL = {
  dropped: "бросил",
  skipping: "3 пропуска",
  stale: "10+ дней",
  graduated: "выпускник",
} as const;

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function statusChip(status: LessonStatus) {
  if (status === "conducted") return <Chip tone="good" size="s">проведён</Chip>;
  if (status === "penalty") return <Chip tone="bad" size="s">штраф</Chip>;
  return <Chip tone="amber" size="s">{LESSON_STATUS_LABEL[status]}</Chip>;
}

export default async function TeacherCard({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("manager", "curator", "head", "admin");
  const { id } = await params;
  const teacher = await findTeacherById(id);
  if (!teacher) notFound();

  const [
    studentsWithFlags,
    allTeachers,
    availability,
    quality,
    recentLessons,
    weeklyChart,
  ] = await Promise.all([
    listTeacherStudentsWithFlags(id),
    listTeachersForCurator(),
    getTeacherAvailability(id),
    getTeacherQuality(id),
    listLessonsForTeacher(id, 10),
    getTeacherWeeklyChart12W(id),
  ]);

  const otherTeachers = allTeachers
    .filter((t) => t.id !== id && t.status === "active")
    .map((t) => ({ id: t.id, full_name: t.full_name }));

  const activeCount = studentsWithFlags.filter((s) => s.status === "active").length;
  const flaggedCount = studentsWithFlags.filter(
    (s) => s.attention_kind || s.is_low_balance,
  ).length;

  const weekMax = Math.max(1, ...weeklyChart.map((w) => w.conducted + w.penalty));

  return (
    <AppShell title={teacher.full_name}>
      {/* Hero — компактный */}
      <div
        className="bg-ivory rounded-[16px] p-4 mb-3"
        style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Chip
            tone={
              teacher.status === "active"
                ? "good"
                : teacher.status === "fired"
                  ? "bad"
                  : "neutral"
            }
            size="s"
          >
            {STATUS_LABEL[teacher.status as keyof typeof STATUS_LABEL] ?? teacher.status}
          </Chip>
          {teacher.phone && (
            <span className="text-[13px] text-olive tabular-nums">{teacher.phone}</span>
          )}
          <Link
            href={`/manager/teachers/${teacher.id}/edit`}
            className="ml-auto text-[12px] font-medium text-charcoal px-3 py-1.5 rounded-[10px] bg-ivory no-underline"
            style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
          >
            Редактировать
          </Link>
        </div>
        {teacher.hired_at && (
          <div className="text-[12px] text-stone mt-1 tabular-nums">
            работает с {fmtDate(teacher.hired_at)}
          </div>
        )}
      </div>

      {/* KPI 30 дней */}
      {quality && (
        <section className="mb-4">
          <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mb-2">
            За 30 дней
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MetricTile
              label="Уроков"
              value={quality.total_lessons_30d}
              sub={`провёл ${quality.conducted_30d} · штраф ${quality.penalty_30d}`}
            />
            <MetricTile
              label="Активных учеников"
              value={quality.active_students}
              sub={
                quality.attention_now > 0
                  ? `во «Внимании» ${quality.attention_now}`
                  : "все в норме"
              }
              tone={quality.attention_now > 0 ? "warn" : "good"}
            />
            <MetricTile
              label="% штраф"
              value={`${quality.penalty_pct}%`}
              sub="штраф / (провёл+штраф)"
              tone={
                quality.penalty_pct >= 15 ? "bad" : quality.penalty_pct >= 8 ? "warn" : undefined
              }
            />
            <MetricTile
              label="% отмен"
              value={`${quality.cancel_pct}%`}
              sub={`учитель ${quality.cancelled_by_teacher_30d} · ученик ${quality.cancelled_by_student_30d}`}
              tone={
                quality.cancel_pct >= 25 ? "bad" : quality.cancel_pct >= 15 ? "warn" : undefined
              }
            />
          </div>
          {(quality.dropped_last_90d > 0 || quality.risk_score >= 5) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {quality.dropped_last_90d > 0 && (
                <Chip tone="bad" size="s">
                  Бросили за 90д: {quality.dropped_last_90d}
                </Chip>
              )}
              <Chip
                tone={quality.risk_score >= 10 ? "bad" : quality.risk_score >= 5 ? "warn" : "neutral"}
                size="s"
              >
                Риск-скор: {quality.risk_score.toFixed(1)}
              </Chip>
            </div>
          )}
        </section>
      )}

      {/* Активные ученики — главное сверху */}
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone">
          Ученики · {activeCount}
        </div>
        {flaggedCount > 0 && (
          <Chip tone="warn" size="s">
            проблемных {flaggedCount}
          </Chip>
        )}
      </div>

      {studentsWithFlags.length === 0 ? (
        <div
          className="bg-ivory rounded-[14px] py-8 text-center mb-4"
          style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
        >
          <p className="text-olive text-[13px]">У учителя нет активных учеников.</p>
        </div>
      ) : (
        <div
          className="bg-ivory rounded-[14px] px-4 mb-4"
          style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
        >
          {studentsWithFlags.map((s, i) => {
            const flag = s.attention_kind
              ? ATTENTION_LABEL[s.attention_kind as keyof typeof ATTENTION_LABEL]
              : null;
            const flagTone = s.attention_kind === "dropped" ? "bad" : "warn";
            return (
              <Link
                key={s.id}
                href={`/teacher/student/${s.id}`}
                className={`grid grid-cols-[1fr_auto] items-center gap-3 py-[12px] no-underline text-near-black ${
                  i > 0 ? "border-t border-border-cream" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[15px] font-medium truncate">{s.full_name}</span>
                    {flag && <Chip tone={flagTone} size="s">{flag}</Chip>}
                    {s.is_low_balance && !flag && (
                      <Chip tone="bad" size="s">баланс {s.balance}</Chip>
                    )}
                    {s.status === "paused" && <Chip tone="neutral" size="s">пауза</Chip>}
                  </div>
                  <div className="text-[12px] text-olive tabular-nums mt-0.5">
                    {s.last_lesson_date
                      ? `последний урок ${fmtDate(s.last_lesson_date)} · ${s.days_since_last} дн.`
                      : "ещё не было уроков"}
                  </div>
                </div>
                <div
                  className={`font-serif text-[18px] font-medium tabular-nums ${
                    s.balance <= 0 ? "text-crimson" : ""
                  }`}
                >
                  {s.balance}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Метрики 30 дн */}
      {quality && (
        <>
          <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mb-2">
            Результаты за 30 дней
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <MetricTile
              label="Уроков"
              value={quality.conducted_30d + quality.penalty_30d}
              sub={
                <>
                  провёл {quality.conducted_30d}
                  {quality.penalty_30d > 0 && ` · штраф ${quality.penalty_30d}`}
                </>
              }
            />
            <MetricTile
              label="% штрафов"
              value={`${quality.penalty_pct}%`}
              tone={quality.penalty_pct >= 15 ? "bad" : quality.penalty_pct >= 8 ? "warn" : "good"}
              sub={`из ${quality.conducted_30d + quality.penalty_30d} засчитанных`}
            />
            <MetricTile
              label="% отмен"
              value={`${quality.cancel_pct}%`}
              tone={quality.cancel_pct >= 25 ? "bad" : quality.cancel_pct >= 15 ? "warn" : "good"}
              sub={`учитель ${quality.cancelled_by_teacher_30d} · ученик ${quality.cancelled_by_student_30d}`}
            />
            <MetricTile
              label="Risk score"
              value={quality.risk_score.toFixed(1)}
              tone={quality.risk_score >= 10 ? "bad" : quality.risk_score >= 5 ? "warn" : "good"}
              sub={
                quality.dropped_last_90d > 0
                  ? `${quality.dropped_last_90d} бросило за 90д`
                  : quality.attention_now > 0
                    ? `${quality.attention_now} в attention`
                    : "хороший показатель"
              }
            />
          </div>

          {/* Тренд по неделям */}
          <div
            className="bg-ivory rounded-[14px] p-4 mb-4"
            style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone">
                12 недель
              </div>
              <div className="text-[11px] text-stone tabular-nums">
                {weeklyChart.reduce((s, w) => s + w.conducted + w.penalty, 0)} уроков
              </div>
            </div>
            <div className="h-[64px] grid grid-cols-12 gap-1 items-end">
              {weeklyChart.map((w) => {
                const total = w.conducted + w.penalty;
                const h = Math.max(2, (total / weekMax) * 56);
                return (
                  <div key={w.week_start} className="flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-[2px]"
                      style={{
                        height: h,
                        backgroundColor: total === 0 ? "#e8e6dc" : "#4d4c48",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Последние уроки */}
      {recentLessons.length > 0 && (
        <>
          <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mb-2">
            Последние уроки
          </div>
          <div
            className="bg-ivory rounded-[14px] px-4 mb-4"
            style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
          >
            {recentLessons.map((l, i) => (
              <Link
                key={l.id}
                href={`/teacher/student/${l.student_id}`}
                className={`grid grid-cols-[1fr_auto] items-center gap-3 py-[10px] no-underline text-near-black ${
                  i > 0 ? "border-t border-border-cream" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="text-[14px] font-medium truncate">{l.student_name}</div>
                  <div className="text-[12px] text-olive tabular-nums mt-0.5">
                    {fmtDate(l.lesson_date)}
                    {l.lesson_time ? ` · ${l.lesson_time}` : ""}
                    {l.topic ? ` · ${l.topic}` : ""}
                  </div>
                </div>
                {statusChip(l.status)}
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Расписание availability */}
      <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mb-2">
        Когда готов работать
        {availability.max_new_students !== null && (
          <span className="text-stone normal-case tracking-normal ml-2">
            · возьмёт ещё {availability.max_new_students}
          </span>
        )}
      </div>
      <div className="mb-5">
        <AvailabilityView slots={availability.slots} />
      </div>

      {/* Действия */}
      <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mb-2">
        Действия
      </div>
      <TeacherActions
        teacherId={teacher.id}
        currentStatus={teacher.status}
        activeStudentsCount={activeCount}
        otherTeachers={otherTeachers}
      />
    </AppShell>
  );
}

function MetricTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: React.ReactNode;
  tone?: "good" | "warn" | "bad";
}) {
  const valueColor =
    tone === "bad" ? "text-crimson" : tone === "warn" ? "text-terracotta" : tone === "good" ? "text-moss" : "";
  return (
    <div
      className="bg-ivory rounded-[14px] p-3"
      style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
    >
      <div className="text-[10px] uppercase tracking-[0.6px] font-medium text-stone mb-1">
        {label}
      </div>
      <div className={`font-serif text-[24px] font-medium tabular-nums leading-none ${valueColor}`}>
        {value}
      </div>
      {sub && (
        <div className="text-[11px] text-olive mt-1 tabular-nums">{sub}</div>
      )}
    </div>
  );
}
