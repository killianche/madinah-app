import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { findTeacherByUserId } from "@/lib/repos/teachers";
import { getTeacherDayAgenda } from "@/lib/repos/schedules";
import { TodayAgenda } from "./today-agenda";

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

  const agenda = await getTeacherDayAgenda(teacher.id, date);

  const prev = shiftDate(date, -1);
  const next = shiftDate(date, +1);
  const firstName = teacher.full_name.split(" ")[0];
  const d = new Date(date);
  const prettyDate = `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;

  return (
    <AppShell>
      {/* Hero greeting */}
      <section className="mb-6">
        <h1 className="font-serif text-[32px] leading-[1.15] tracking-[-0.4px] font-medium text-near-black">
          Здравствуй, {firstName}
        </h1>
        <p className="text-[15px] text-olive mt-1 capitalize">{prettyDate}</p>
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

      <TodayAgenda agenda={agenda} date={date} />

      {/* Primary CTA */}
      <Link
        href={`/teacher/lesson/new?date=${date}`}
        className="mt-8 w-full inline-flex items-center justify-center gap-2 bg-terracotta text-ivory font-medium rounded-[12px] py-[14px] px-5 no-underline hover:brightness-95 active:scale-[0.985] transition-transform"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>Записать урок</span>
      </Link>
    </AppShell>
  );
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
