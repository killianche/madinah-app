import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { sql } from "@/lib/db";

interface Stats {
  total_students: number;
  total_charity: number;
  active_teachers: number;
  lessons_last30: number;
  revenue_lessons_last30: number;
}

export const metadata = { title: "Директор — Madinah" };

export default async function DirectorDashboard() {
  await requireRole("director", "admin");

  const [row] = await sql<Stats[]>`
    select
      (select count(*)::int from students where status = 'active') as total_students,
      (select count(*)::int from students where status = 'active' and is_charity) as total_charity,
      (select count(*)::int from teachers where status = 'active') as active_teachers,
      (select count(*)::int from lessons
         where deleted_at is null
           and lesson_date >= current_date - interval '30 days') as lessons_last30,
      (select count(*)::int from lessons l
         join students s on s.id = l.student_id
         where l.deleted_at is null
           and l.status in ('conducted', 'penalty')
           and not s.is_charity
           and l.lesson_date >= current_date - interval '30 days') as revenue_lessons_last30
  `;
  const stats = row!;

  const tiles = [
    { label: "Активных учеников", value: stats.total_students },
    { label: "Из них благотворительных", value: stats.total_charity },
    { label: "Активных учителей", value: stats.active_teachers },
    { label: "Уроков за 30 дней", value: stats.lessons_last30 },
    { label: "Оплачиваемых уроков за 30 дней", value: stats.revenue_lessons_last30 },
  ];

  return (
    <AppShell title="Сводка">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map((t) => (
          <div key={t.label} className="card">
            <p className="text-sm text-olive-gray">{t.label}</p>
            <p className="font-serif text-4xl mt-1 tabular-nums">{t.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 text-sm text-olive-gray">
        Детальная аналитика — в Metabase (будет подключён после запуска).
      </div>
    </AppShell>
  );
}
