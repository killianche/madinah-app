import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { findTeacherByUserId } from "@/lib/repos/teachers";
import { getTeacherMonthlyStats } from "@/lib/repos/lessons";

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

export default async function TeacherStats() {
  const { user } = await requireRole("teacher");
  const teacher = await findTeacherByUserId(user.id);
  if (!teacher) notFound();

  const monthly = await getTeacherMonthlyStats(teacher.id, 24);

  const totalConducted = monthly.reduce((s, m) => s + m.conducted, 0);
  const totalAll = monthly.reduce((s, m) => s + m.total, 0);
  const totalStudentsUniq = await (async () => {
    // сумма "новых учеников" по месяцам не равна уникальным за период,
    // но как грубая метрика дадим максимум students по месяцу
    if (monthly.length === 0) return 0;
    return monthly.reduce((max, m) => Math.max(max, m.students), 0);
  })();

  return (
    <AppShell title="Статистика">
      {monthly.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-olive-gray">Пока уроков не было.</p>
        </div>
      ) : (
        <>
          <div className="card mb-6">
            <p className="text-sm text-olive-gray">Суммарно</p>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <span>
                Уроков:{" "}
                <span className="font-medium text-near-black tabular-nums">{totalAll}</span>
              </span>
              <span>
                Проведено:{" "}
                <span className="font-medium text-near-black tabular-nums">{totalConducted}</span>
              </span>
              <span>
                Пиковая загрузка:{" "}
                <span className="font-medium text-near-black tabular-nums">
                  {totalStudentsUniq} уч./мес
                </span>
              </span>
            </div>
          </div>

          <h2 className="text-lg font-serif mb-3">По месяцам</h2>
          <ul className="space-y-2">
            {monthly.map((m) => (
              <li key={m.month.toString()} className="bg-ivory rounded-md shadow-ring p-3">
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <span className="font-medium">{formatMonth(m.month)}</span>
                  <span className="text-xs text-olive-gray tabular-nums">
                    учеников {m.students}
                    {m.new_students > 0 && ` (новых ${m.new_students})`} · уроков {m.total}
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
        </>
      )}
    </AppShell>
  );
}
