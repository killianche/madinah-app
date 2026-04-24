import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { findTeacherByUserId } from "@/lib/repos/teachers";
import { getTeacherDayAgenda, getTeacherWeekSchedule } from "@/lib/repos/schedules";
import { TodayAgenda } from "./today-agenda";
import { WeekStrip } from "@/components/ui/week-strip";

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
  const today = new Date().toISOString().slice(0, 10);
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;

  const [agenda, weekSlots] = await Promise.all([
    getTeacherDayAgenda(teacher.id, date),
    getTeacherWeekSchedule(teacher.id),
  ]);

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
        <p className="text-[14px] text-olive mt-1.5 first-letter:capitalize">{prettyDate}</p>
      </section>

      {/* Date navigation */}
      <div className="flex items-center gap-2 mb-5 -ml-2">
        <Link
          href={`/teacher?date=${prev}`}
          className="w-11 h-11 flex items-center justify-center rounded-full text-charcoal no-underline hover:bg-border-cream"
          aria-label="Предыдущий день"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        {date !== today && (
          <Link href="/teacher" className="text-[13px] text-terracotta no-underline">
            сегодня
          </Link>
        )}
        <Link
          href={`/teacher?date=${next}`}
          className="w-11 h-11 flex items-center justify-center rounded-full text-charcoal no-underline hover:bg-border-cream ml-auto"
          aria-label="Следующий день"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </div>

      {/* Моя неделя — декоративно */}
      {weekSlots.length > 0 && (
        <section className="mb-5">
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone">
              Моя неделя
            </span>
            <span className="text-[12px] text-stone">напоминание</span>
          </div>
          <WeekStrip slots={weekSlots} />
        </section>
      )}

      <TodayAgenda agenda={agenda} date={date} />
    </AppShell>
  );
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
