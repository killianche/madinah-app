import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { findTeacherByUserId } from "@/lib/repos/teachers";
import { getTeacherDayAgenda, getTeacherUpcomingScheduled } from "@/lib/repos/schedules";
import {
  listLessonsForTeacher,
  getTeacherStreak,
  getTeacherBestStreak,
  getTeacherWeekChart,
} from "@/lib/repos/lessons";
import { teacherStudentList } from "@/lib/repos/students";
import { getTeacherSalaryPeriods, getSchoolSettings } from "@/lib/repos/admin";
import { TodayAgenda } from "./today-agenda";
import { Donut } from "@/components/ui/donut";
import { Chip } from "@/components/ui/chip";
import { QuickMarkRow } from "./quick-mark/quick-mark-row";

export const metadata = { title: "Сегодня — Madinah" };
export const dynamic = "force-dynamic";

const WEEKDAYS_LONG = [
  "воскресенье", "понедельник", "вторник", "среда",
  "четверг", "пятница", "суббота",
];
const WD_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const MONTHS_NOM = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

export default async function TeacherHome({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { user } = await requireRole("teacher");
  const teacher = await findTeacherByUserId(user.id);

  if (!teacher) {
    return (
      <AppShell title="Сегодня">
        <div className="bg-ivory shadow-ring rounded-md p-6">
          <p className="text-olive">
            Ваш профиль учителя не настроен. Обратитесь к администратору.
          </p>
        </div>
      </AppShell>
    );
  }

  const sp = await searchParams;
  const today = new Date().toLocaleDateString("sv-SE");
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;

  const [agenda, pastLessons, upcomingSlots, myStudents, streak, bestStreak, weekChart, salaryPeriods, schoolSettings] =
    await Promise.all([
      getTeacherDayAgenda(teacher.id, date),
      listLessonsForTeacher(teacher.id, 10),
      getTeacherUpcomingScheduled(teacher.id, 6),
      teacherStudentList(teacher.id),
      getTeacherStreak(teacher.id),
      getTeacherBestStreak(teacher.id),
      getTeacherWeekChart(teacher.id),
      getTeacherSalaryPeriods(teacher.id, 3),
      getSchoolSettings(),
    ]);

  // Метрики дня
  const scheduled = agenda.filter((a) => a.kind === "scheduled");
  const done = agenda.filter((a) => a.kind === "lesson");
  const conducted = done.filter((a) => a.lesson_status === "conducted").length;
  const penalty = done.filter((a) => a.lesson_status === "penalty").length;
  const cancelled = done.length - conducted - penalty;
  const counted = conducted + penalty;
  const totalPlanned = done.length + scheduled.length;
  const ahead = scheduled.length;
  const dayPct = totalPlanned > 0 ? counted / totalPlanned : 0;

  // Дальше: ВСЕ запланированные сегодня уроки независимо от времени.
  // Если время уже прошло — учитель может пометить урок задним числом прямо отсюда.
  // Для других дат (просмотр истории/будущего) блок не показываем — см. ниже isToday.
  const heroUpcomingToday = scheduled.filter((s) => !!s.slot_time);

  // Низкий баланс / attention
  const lowBalance = myStudents
    .filter((s) => s.status === "active" && s.balance < 3)
    .sort((a, b) => a.balance - b.balance)
    .slice(0, 5);

  // Salary: current half-month + past months
  const todayD = new Date(today);
  const currentYear = todayD.getFullYear();
  const currentMonth = todayD.getMonth() + 1;
  const currentHalf = todayD.getDate() <= 15 ? "first" : "second";
  const lastDayOfMonth = new Date(currentYear, currentMonth, 0).getDate();

  const currentHalfBucket = salaryPeriods.find(
    (b) => b.year === currentYear && b.month === currentMonth && b.half === currentHalf,
  );

  const pastMonthsMap = new Map<string, { year: number; month: number; conducted: number; penalty: number; earned: number }>();
  for (const b of salaryPeriods) {
    if (b.year === currentYear && b.month === currentMonth) continue;
    const key = `${b.year}-${String(b.month).padStart(2, "0")}`;
    const prev2 = pastMonthsMap.get(key);
    if (prev2) {
      prev2.conducted += b.conducted;
      prev2.penalty += b.penalty;
      prev2.earned += b.earned;
    } else {
      pastMonthsMap.set(key, { year: b.year, month: b.month, conducted: b.conducted, penalty: b.penalty, earned: b.earned });
    }
  }
  const pastMonths = Array.from(pastMonthsMap.values())
    .sort((a, b) => b.year - a.year || b.month - a.month)
    .slice(0, 3);

  const currency = schoolSettings.currency;

  const prev = shiftDate(date, -1);
  const next = shiftDate(date, +1);
  const d = new Date(date);
  const prettyDate = `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
  const isToday = date === today;

  // Week chart bar heights
  const weekMax = Math.max(1, ...weekChart.map((w) => w.count));
  const weekTotal = weekChart.reduce((s, w) => s + w.count, 0);

  return (
    <AppShell>
      {/* Заголовок дня */}
      <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mb-2">
        Сегодня
      </div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-serif text-[26px] font-medium tracking-[-0.3px] leading-tight first-letter:capitalize">
          {prettyDate}
        </h1>
        <div className="flex items-center gap-1">
          <Link
            href={`/teacher?date=${prev}`}
            className="w-9 h-9 flex items-center justify-center rounded-full text-charcoal no-underline"
            aria-label="Предыдущий день"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          {!isToday && (
            <Link
              href="/teacher"
              className="text-[12px] font-medium text-terracotta px-3 h-9 flex items-center rounded-full no-underline"
              style={{ boxShadow: "inset 0 0 0 1px rgba(201,100,66,0.4)" }}
            >
              сегодня
            </Link>
          )}
          <Link
            href={`/teacher?date=${next}`}
            className="w-9 h-9 flex items-center justify-center rounded-full text-charcoal no-underline"
            aria-label="Следующий день"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Hero progress */}
      {totalPlanned > 0 && (
        <div
          className="bg-ivory rounded-[18px] p-5 mb-3"
          style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="font-serif text-[44px] font-medium tabular-nums leading-none tracking-[-0.6px]">
                  {counted}
                </span>
                <span className="font-serif text-[22px] tabular-nums text-stone">
                  /{totalPlanned}
                </span>
              </div>
              <div className="text-[12px] uppercase tracking-[0.6px] font-medium text-stone mt-2">
                уроков сегодня
              </div>
            </div>
            <Donut pct={dayPct} size={64} strokeWidth={5} />
          </div>

          {/* Stacked bar */}
          {(conducted + penalty + cancelled + ahead) > 0 && (
            <div className="flex gap-[2px] h-[6px] rounded-full overflow-hidden mt-4">
              {conducted > 0 && (
                <div className="bg-moss h-full" style={{ flex: conducted }} />
              )}
              {penalty > 0 && (
                <div className="bg-crimson h-full" style={{ flex: penalty }} />
              )}
              {cancelled > 0 && (
                <div className="h-full" style={{ flex: cancelled, backgroundColor: "#d4911d" }} />
              )}
              {ahead > 0 && (
                <div className="bg-warm-sand h-full" style={{ flex: ahead }} />
              )}
            </div>
          )}

          {/* Легенда */}
          <div className="flex items-center justify-between mt-2 text-[12px] text-olive">
            <div className="flex flex-wrap gap-x-3 gap-y-1 tabular-nums">
              {conducted > 0 && <span className="text-moss">{conducted} провёл</span>}
              {penalty > 0 && <span className="text-crimson">{penalty} штраф</span>}
              {cancelled > 0 && <span className="text-[#8a5a1f] dark:text-[#c89c6a]">{cancelled} отм.</span>}
            </div>
            {ahead > 0 && (
              <span className="text-stone tabular-nums">{ahead} впереди</span>
            )}
          </div>

          {/* Дальше: все запланированные уроки на сегодня.
              Имя ученика — Link на карточку. Кнопки «✓» (провёл) и «Ш» (штраф) — inline-запись урока. */}
          {heroUpcomingToday.length > 0 && isToday && (
            <div
              className="mt-4 pt-3"
              style={{ borderTop: "1px solid #f0eee6" }}
            >
              <div className="text-[10px] uppercase tracking-[0.6px] font-medium text-stone mb-2">
                Дальше · {heroUpcomingToday.length}
              </div>
              {heroUpcomingToday.map((s, i) => (
                <QuickMarkRow
                  key={`${s.student_id}-${s.slot_time}`}
                  studentId={s.student_id}
                  studentName={s.student_name}
                  slotTime={s.slot_time}
                  highlight={i === 0}
                  showDivider={i > 0}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tiles 2x1: Серия + Эта неделя */}
      <div className="grid grid-cols-2 gap-[10px] mb-3">
        {/* Серия */}
        <div
          className="bg-ivory rounded-[14px] p-4"
          style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
        >
          <div className="text-[10px] uppercase tracking-[0.6px] font-medium text-stone mb-2">
            Серия
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-serif text-[28px] font-medium tabular-nums leading-none">
              {streak}
            </span>
            <span className="text-[12px] text-olive">
              {streak === 1 ? "день" : streak < 5 ? "дня" : "дней"}
            </span>
          </div>
          {bestStreak > 0 && (
            <div className="text-[11px] text-olive mt-1 tabular-nums">
              лучшая · {bestStreak}
            </div>
          )}
        </div>

        {/* Эта неделя — мини bar chart */}
        <Link
          href="/teacher/stats"
          className="bg-ivory rounded-[14px] p-4 no-underline text-near-black"
          style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
        >
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-[10px] uppercase tracking-[0.6px] font-medium text-stone">
              Эта неделя
            </span>
            <span className="text-[11px] text-olive tabular-nums">{weekTotal}</span>
          </div>
          <div className="h-[44px] grid grid-cols-7 gap-1 items-end">
            {weekChart.map((day) => {
              const isTodayBar = day.date === today;
              const h = Math.max(4, (day.count / weekMax) * 36);
              return (
                <div key={day.date} className="flex flex-col items-center gap-1">
                  <div
                    className="w-[70%] rounded-[1px]"
                    style={{
                      height: h,
                      backgroundColor: isTodayBar
                        ? "#c96442"
                        : day.count > 0
                          ? "#4d4c48"
                          : "#e8e6dc",
                    }}
                  />
                  <span
                    className={`text-[9px] font-medium tracking-wide uppercase ${
                      isTodayBar ? "text-terracotta" : "text-stone"
                    }`}
                  >
                    {WD_SHORT[(day.weekday) % 7]}
                  </span>
                </div>
              );
            })}
          </div>
        </Link>
      </div>

      {/* Зарплата */}
      {(currentHalfBucket || pastMonths.length > 0) && (
        <div
          className="bg-ivory rounded-[18px] p-5 mb-3"
          style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
        >
          <div className="text-[10px] uppercase tracking-[0.6px] font-medium text-stone mb-3">
            Зарплата
          </div>

          {/* Текущий полумесяц */}
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[12px] text-olive mb-1">
                {currentHalf === "first"
                  ? `1–15 ${MONTHS_GEN[currentMonth - 1]}`
                  : `16–${lastDayOfMonth} ${MONTHS_GEN[currentMonth - 1]}`}
                {" · текущий период"}
              </div>
              <div className="font-serif text-[36px] font-medium tabular-nums leading-none">
                {currentHalfBucket
                  ? Math.round(currentHalfBucket.earned).toLocaleString("ru-RU")
                  : "0"}{" "}
                <span className="text-[20px] text-stone">{currency}</span>
              </div>
              {currentHalfBucket && (currentHalfBucket.conducted + currentHalfBucket.penalty) > 0 && (
                <div className="text-[12px] text-olive mt-1 tabular-nums">
                  {currentHalfBucket.conducted > 0 && `${currentHalfBucket.conducted} провёл`}
                  {currentHalfBucket.conducted > 0 && currentHalfBucket.penalty > 0 && " · "}
                  {currentHalfBucket.penalty > 0 && `${currentHalfBucket.penalty} штраф`}
                </div>
              )}
            </div>
            {currentHalfBucket && (
              <div className="text-right">
                <div className="text-[11px] text-olive">ставка</div>
                <div className="text-[13px] font-medium tabular-nums mt-0.5">
                  {currentHalfBucket.rate_conducted.toLocaleString("ru-RU")} / {currentHalfBucket.rate_penalty.toLocaleString("ru-RU")}
                </div>
                <div className="text-[10px] text-stone mt-0.5">провёл / штраф</div>
              </div>
            )}
          </div>

          {/* История по месяцам */}
          {pastMonths.length > 0 && (
            <div className="mt-4 pt-3" style={{ borderTop: "1px solid #f0eee6" }}>
              {pastMonths.map((m) => (
                <div key={`${m.year}-${m.month}`} className="flex items-baseline justify-between py-[6px]">
                  <div className="text-[14px] font-medium capitalize">
                    {MONTHS_NOM[m.month - 1]}{m.year !== currentYear ? ` ${m.year}` : ""}
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-[12px] text-olive tabular-nums">
                      {m.conducted}{m.penalty > 0 ? `/${m.penalty}` : ""}
                    </span>
                    <span className="font-serif text-[18px] font-medium tabular-nums">
                      {Math.round(m.earned).toLocaleString("ru-RU")} {currency}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Готов брать учеников — справочно для куратора (над расписанием) */}
      <Link
        href="/teacher/availability"
        className="flex items-center justify-between bg-ivory rounded-[14px] px-4 py-[14px] mb-3 no-underline hover:no-underline"
        style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
      >
        <div>
          <div className="text-[10px] uppercase tracking-[0.6px] font-medium text-stone no-underline">
            Расписание для куратора
          </div>
          <div className="text-[15px] font-medium mt-0.5 text-near-black no-underline">
            Готов брать учеников
          </div>
        </div>
        <svg viewBox="0 0 24 24" className="w-4 h-4 text-stone" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </Link>

      {/* Расписание: 2 прошедших + 6 предстоящих, кросс-дневное */}
      <TodayAgenda
        pastLessons={pastLessons}
        upcomingSlots={upcomingSlots}
      />

      {/* Требуют внимания */}
      {lowBalance.length > 0 && (
        <section className="mb-6">
          <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mb-2">
            Требуют внимания
          </div>
          <div
            className="bg-ivory rounded-[14px] px-4"
            style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
          >
            {lowBalance.map((s, i) => (
              <Link
                key={s.id}
                href={`/teacher/student/${s.id}`}
                className={`grid grid-cols-[1fr_auto_auto] items-center gap-3 py-[12px] no-underline text-near-black ${
                  i > 0 ? "border-t border-border-cream" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="text-[15px] font-medium truncate">{s.full_name}</div>
                  {s.phone && (
                    <div className="text-[12px] text-olive tabular-nums mt-0.5">
                      {s.phone}
                    </div>
                  )}
                </div>
                <Chip tone={s.balance <= 0 ? "bad" : "amber"} size="s">
                  баланс {s.balance}
                </Chip>
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-stone" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
