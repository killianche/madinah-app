import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { Chip } from "@/components/ui/chip";
import { Sparkline } from "@/components/ui/sparkline";
import { findTeacherByUserId } from "@/lib/repos/teachers";
import {
  getTeacherMonthlyStats,
  getTeacherTotalStats,
  getTeacherTopStudents,
  getTeacherDailyLessons,
  getTeacherDailyAverage,
  getTeacherStreak,
  getTeacherSchoolRank,
  getTeacherTodayYesterday,
} from "@/lib/repos/lessons";

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

export default async function TeacherStats() {
  const { user } = await requireRole("teacher");
  const teacher = await findTeacherByUserId(user.id);
  if (!teacher) notFound();

  const now = new Date();
  const [monthly, totals, topStudents, dailyNow, dailyAvg, streak, rank, todayYesterday] =
    await Promise.all([
      getTeacherMonthlyStats(teacher.id, 24),
      getTeacherTotalStats(teacher.id),
      getTeacherTopStudents(teacher.id, 10),
      getTeacherDailyLessons(teacher.id, now.getFullYear(), now.getMonth() + 1),
      getTeacherDailyAverage(teacher.id, 30),
      getTeacherStreak(teacher.id),
      getTeacherSchoolRank(teacher.id),
      getTeacherTodayYesterday(teacher.id),
    ]);

  const todayKey = new Date().toLocaleDateString("sv-SE");
  const yKey = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString("sv-SE");
  })();
  const today = todayYesterday.find((r) => r.date === todayKey);
  const yesterday = todayYesterday.find((r) => r.date === yKey);
  const todayCount = (today?.conducted ?? 0) + (today?.penalty ?? 0);
  const yCount = (yesterday?.conducted ?? 0) + (yesterday?.penalty ?? 0);

  // массив 1..N дней для спарклайна
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const sparkData: number[] = Array(daysInMonth).fill(0);
  for (const row of dailyNow) {
    if (row.day >= 1 && row.day <= daysInMonth) sparkData[row.day - 1] = row.conducted;
  }
  // rank.percentile = сколько процентов учителей отстают от тебя
  // (если 77 — значит ты обогнал 77% коллег, ты в верхних 23%).
  const betterThan = rank && rank.totalTeachers > 1 ? rank.percentile : null;

  const heroMonth = monthly[0];
  const prevMonth = monthly[1];
  // Считаем только засчитанные (conducted+penalty) — отмены не учитываются.
  const counted = (m: typeof heroMonth) => (m ? m.conducted + m.penalty : 0);
  const deltaLessons =
    heroMonth && prevMonth ? counted(heroMonth) - counted(prevMonth) : null;
  const pastMonths = monthly.slice(1, 7);

  const experienceMonths = totals.first_lesson_date
    ? monthsBetween(new Date(totals.first_lesson_date))
    : 0;
  const experienceText = experienceMonths >= 12
    ? `${Math.floor(experienceMonths / 12)} г. ${experienceMonths % 12} мес.`
    : `${experienceMonths} мес.`;

  return (
    <AppShell title="Статистика">
      {/* Сегодня / Вчера */}
      <div
        className="bg-ivory rounded-[16px] p-[18px] mb-[14px]"
        style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.6px] font-medium text-stone mb-2">
              Сегодня
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-serif text-[36px] font-medium tabular-nums leading-none">
                {todayCount}
              </span>
              {todayCount > 0 && (
                <span className="text-[12px] text-olive">
                  {todayCount === 1 ? "урок" : todayCount < 5 ? "урока" : "уроков"}
                </span>
              )}
            </div>
            <div className="text-[12px] text-olive tabular-nums mt-2 flex gap-2 flex-wrap">
              {today && today.conducted > 0 && <span>провёл {today.conducted}</span>}
              {today && today.penalty > 0 && (
                <>
                  <span className="text-stone">·</span>
                  <span>штраф {today.penalty}</span>
                </>
              )}
              {today && today.cancelled > 0 && (
                <>
                  <span className="text-stone">·</span>
                  <span>отм. {today.cancelled}</span>
                </>
              )}
              {!today && <span className="text-stone">пока ничего</span>}
            </div>
          </div>
          <div className="border-l border-border-cream pl-3">
            <div className="text-[10px] uppercase tracking-[0.6px] font-medium text-stone mb-2">
              Вчера
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-serif text-[36px] font-medium tabular-nums leading-none text-charcoal">
                {yCount}
              </span>
              {yCount > 0 && (
                <span className="text-[12px] text-olive">
                  {yCount === 1 ? "урок" : yCount < 5 ? "урока" : "уроков"}
                </span>
              )}
            </div>
            <div className="text-[12px] text-olive tabular-nums mt-2 flex gap-2 flex-wrap">
              {yesterday && yesterday.conducted > 0 && <span>провёл {yesterday.conducted}</span>}
              {yesterday && yesterday.penalty > 0 && (
                <>
                  <span className="text-stone">·</span>
                  <span>штраф {yesterday.penalty}</span>
                </>
              )}
              {yesterday && yesterday.cancelled > 0 && (
                <>
                  <span className="text-stone">·</span>
                  <span>отм. {yesterday.cancelled}</span>
                </>
              )}
              {!yesterday && <span className="text-stone">было тихо</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-3 gap-[10px] mb-[14px]">
        <div className="bg-ivory rounded-[14px] shadow-ring p-[14px]">
          <div className="text-[10px] uppercase tracking-[0.6px] font-medium text-stone mb-1">
            В день
          </div>
          <div className="font-serif text-[22px] font-medium tabular-nums leading-none">
            {dailyAvg}
          </div>
          <div className="text-[11px] text-olive mt-1">уроков в ср.</div>
        </div>
        <div className="bg-ivory rounded-[14px] shadow-ring p-[14px]">
          <div className="text-[10px] uppercase tracking-[0.6px] font-medium text-stone mb-1">
            Стрик
          </div>
          <div className="font-serif text-[22px] font-medium tabular-nums leading-none text-terracotta">
            {streak}
          </div>
          <div className="text-[11px] text-olive mt-1">
            {streak === 1 ? "день подряд" : "дней подряд"}
          </div>
        </div>
        <div className="bg-ivory rounded-[14px] shadow-ring p-[14px]">
          <div className="text-[10px] uppercase tracking-[0.6px] font-medium text-stone mb-1">
            Провёл больше
          </div>
          {betterThan !== null ? (
            <>
              <div
                className={`font-serif text-[22px] font-medium tabular-nums leading-none ${
                  betterThan >= 50 ? "text-moss" : "text-charcoal"
                }`}
              >
                {betterThan}%
              </div>
              <div className="text-[11px] text-olive mt-1">коллег за 30 дн.</div>
            </>
          ) : (
            <>
              <div className="font-serif text-[22px] font-medium leading-none text-stone">—</div>
              <div className="text-[11px] text-olive mt-1">за 30 дн.</div>
            </>
          )}
        </div>
      </div>

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
            {/* Sparkline */}
            <div className="mb-3">
              <Sparkline data={sparkData} />
              <div className="flex justify-between text-[10px] text-stone mt-1 tabular-nums">
                <span>1</span>
                <span>{Math.floor(daysInMonth / 2)}</span>
                <span>{daysInMonth}</span>
              </div>
            </div>
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
                  {heroMonth.conducted + heroMonth.penalty}
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
                      {(m.cancelled_by_student + m.cancelled_by_teacher) > 0 && (
                        <>
                          <span>·</span>
                          <span>отм. {m.cancelled_by_student + m.cancelled_by_teacher}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="font-serif text-[20px] font-medium tabular-nums">
                    {m.conducted + m.penalty}
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
                    засчитано {s.conducted + s.penalty}
                    <span className="text-stone ml-1">
                      ({s.conducted} провёл{s.penalty > 0 && ` + ${s.penalty} штр`})
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-serif text-[20px] font-medium tabular-nums leading-none">
                    {s.months_with_teacher}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.6px] font-medium text-stone mt-1">
                    {s.months_with_teacher === 1 ? "мес." : "мес."}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {monthly.length === 0 && topStudents.length === 0 && (
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
