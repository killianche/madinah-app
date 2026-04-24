import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { findTeacherByUserId } from "@/lib/repos/teachers";
import { teacherStudentList } from "@/lib/repos/students";
import { getTeacherDayAgenda } from "@/lib/repos/schedules";
import { getTeacherMonthlyStats } from "@/lib/repos/lessons";
import { TodayAgenda } from "./today-agenda";
import { Badge } from "@/components/ui/badge";
import { LESSON_STATUS_LABEL } from "@/lib/types";

export const metadata = { title: "Сегодня — Madinah" };
export const dynamic = "force-dynamic";

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
        <div className="card">
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

  const [agenda, students, monthlyStats] = await Promise.all([
    getTeacherDayAgenda(teacher.id, date),
    teacherStudentList(teacher.id),
    getTeacherMonthlyStats(teacher.id, 6),
  ]);

  const prev = shiftDate(date, -1);
  const next = shiftDate(date, +1);

  return (
    <AppShell title="Сегодня">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href={`/teacher?date=${prev}`} className="btn-ghost text-sm no-underline" aria-label="Предыдущий день">‹</Link>
          <div className="text-sm">
            <div className="font-medium">{formatDayFull(date)}</div>
            {date !== today && (
              <Link href="/teacher" className="text-xs text-terracotta no-underline">сегодня</Link>
            )}
          </div>
          <Link href={`/teacher?date=${next}`} className="btn-ghost text-sm no-underline" aria-label="Следующий день">›</Link>
        </div>
        <Link href={`/teacher/lesson/new?date=${date}`} className="btn-primary no-underline">
          Добавить урок
        </Link>
      </div>

      <TodayAgenda agenda={agenda} date={date} />

      {monthlyStats.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-serif mb-3">По месяцам</h2>
          <ul className="space-y-2">
            {monthlyStats.map((m) => (
              <li
                key={m.month.toString()}
                className="bg-ivory rounded-md shadow-ring p-3"
              >
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <span className="font-medium">{formatMonth(m.month)}</span>
                  <span className="text-xs text-olive-gray tabular-nums">
                    учеников {m.students}
                    {m.new_students > 0 && ` (новых ${m.new_students})`}
                    {" · "}уроков {m.total}
                  </span>
                </div>
                <div className="text-xs text-olive-gray flex gap-x-3 flex-wrap">
                  <span>проведено {m.conducted}</span>
                  {m.penalty > 0 && <span>штраф {m.penalty}</span>}
                  {m.cancelled_by_student > 0 && (
                    <span>отм. учеником {m.cancelled_by_student}</span>
                  )}
                  {m.cancelled_by_teacher > 0 && (
                    <span>отм. учителем {m.cancelled_by_teacher}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-serif">Все мои ученики</h2>
          <span className="text-xs text-olive-gray">
            {students.length} {pluralize(students.length, ["ученик", "ученика", "учеников"])}
          </span>
        </div>
        {students.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-olive-gray">Учеников пока нет. Менеджер добавит их в вашу группу.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {students.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/teacher/student/${s.id}`}
                  className="flex items-center justify-between gap-4 card-compact hover:shadow-lift-md transition-shadow no-underline"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{s.full_name}</span>
                      {s.is_charity && <Badge variant="olive">Благ.</Badge>}
                    </div>
                    {s.last_lesson_date ? (
                      <p className="text-xs text-olive-gray mt-0.5">
                        {formatDate(s.last_lesson_date)} · {LESSON_STATUS_LABEL[s.last_lesson_status!]}
                      </p>
                    ) : (
                      <p className="text-xs text-olive-gray mt-0.5">Ещё не было уроков</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-serif text-xl tabular-nums">{Math.max(s.balance, 0)}</p>
                    <p className="text-[10px] text-olive-gray uppercase tracking-wider">
                      {s.balance < 0 ? "в минусе" : "уроков"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
function formatMonth(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${MONTHS_RU[date.getMonth()]} ${date.getFullYear()}`;
}

function formatDayFull(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function shiftDate(d: string, delta: number): string {
  const date = new Date(d);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function pluralize(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}
