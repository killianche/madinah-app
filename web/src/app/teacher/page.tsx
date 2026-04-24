import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { findTeacherByUserId } from "@/lib/repos/teachers";
import { getTeacherDayAgenda } from "@/lib/repos/schedules";
import { listLessonsForTeacher } from "@/lib/repos/lessons";
import { teacherStudentList } from "@/lib/repos/students";
import { TodayAgenda } from "./today-agenda";
import { Chip } from "@/components/ui/chip";

export const metadata = { title: "Сегодня — Madinah" };
export const dynamic = "force-dynamic";

const WEEKDAYS_LONG = [
  "воскресенье", "понедельник", "вторник", "среда",
  "четверг", "пятница", "суббота",
];
const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
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
          <p className="text-olive-gray">
            Ваш профиль учителя не настроен. Обратитесь к администратору.
          </p>
        </div>
      </AppShell>
    );
  }

  const sp = await searchParams;
  const today = new Date().toLocaleDateString("sv-SE");
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;

  const [agenda, recentLessons, myStudents] = await Promise.all([
    getTeacherDayAgenda(teacher.id, date),
    listLessonsForTeacher(teacher.id, 10),
    teacherStudentList(teacher.id),
  ]);
  const lowBalance = myStudents
    .filter((s) => s.status === "active" && s.balance < 3)
    .sort((a, b) => a.balance - b.balance);

  const prev = shiftDate(date, -1);
  const next = shiftDate(date, +1);
  const firstName = teacher.full_name.split(" ")[0];
  const d = new Date(date);
  const prettyDate = `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;

  return (
    <AppShell>
      {/* Hero greeting */}
      <section className="mb-5">
        <h1 className="font-serif text-[28px] leading-[1.15] tracking-[-0.4px] font-medium text-near-black">
          Ассаламу алейкум,
          <br />
          {firstName}
        </h1>
      </section>

      {/* Date navigation — compact bar */}
      <div
        className="flex items-center justify-between bg-ivory rounded-[14px] shadow-ring px-2 py-2 mb-5"
      >
        <Link
          href={`/teacher?date=${prev}`}
          className="w-10 h-10 flex items-center justify-center rounded-full text-charcoal no-underline hover:bg-border-cream"
          aria-label="Предыдущий день"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <div className="flex flex-col items-center">
          <div className="text-[15px] font-medium first-letter:capitalize leading-tight">
            {prettyDate}
          </div>
          {date !== today ? (
            <Link
              href="/teacher"
              className="text-[11px] text-terracotta no-underline mt-0.5"
            >
              к сегодня
            </Link>
          ) : (
            <div className="text-[11px] text-stone mt-0.5">сегодня</div>
          )}
        </div>
        <Link
          href={`/teacher?date=${next}`}
          className="w-10 h-10 flex items-center justify-center rounded-full text-charcoal no-underline hover:bg-border-cream"
          aria-label="Следующий день"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </div>

      <TodayAgenda agenda={agenda} date={date} recentLessons={recentLessons} />

      {/* Низкий баланс */}
      {lowBalance.length > 0 && (
        <section className="mb-6">
          <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mb-2">
            Низкий баланс
          </div>
          <div
            className="bg-ivory rounded-[14px] px-4"
            style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
          >
            {lowBalance.map((s, i) => (
              <Link
                key={s.id}
                href={`/teacher/student/${s.id}`}
                className={`grid grid-cols-[1fr_auto] items-center gap-3 py-[12px] no-underline text-near-black ${
                  i > 0 ? "border-t border-border-cream" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="text-[15px] font-medium truncate">{s.full_name}</div>
                  {s.phone && (
                    <div className="text-[12px] text-olive tabular-nums mt-0.5">{s.phone}</div>
                  )}
                </div>
                <Chip tone={s.balance <= 0 ? "bad" : "amber"} size="s">
                  {s.balance} уроков
                </Chip>
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
