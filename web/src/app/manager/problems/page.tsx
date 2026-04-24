import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { sql } from "@/lib/db";
import { Badge } from "@/components/ui/badge";

interface Row {
  id: string;
  full_name: string;
  teacher_name: string | null;
  balance: number;
  days_since_last: number | null;
  cancellations_last30: number;
  score: number;
  is_charity: boolean;
}

export const metadata = { title: "Проблемные — Madinah" };

export default async function ProblemsPage() {
  await requireRole("manager", "curator", "head", "director", "admin");

  // Композитный score: дни-с-последнего × 0.3 + отмены × 0.5 + (баланс<5) × 10 × 0.2
  const rows = await sql<Row[]>`
    with last_lesson as (
      select student_id, max(lesson_date) as last_date
      from lessons where deleted_at is null group by student_id
    ),
    cancellations as (
      select student_id, count(*)::int as cnt
      from lessons
      where status in ('cancelled_by_student', 'cancelled_by_teacher')
        and deleted_at is null
        and lesson_date >= current_date - interval '30 days'
      group by student_id
    )
    select
      s.id,
      s.full_name,
      t.full_name as teacher_name,
      s.balance,
      s.is_charity,
      (current_date - ll.last_date)::int as days_since_last,
      coalesce(c.cnt, 0) as cancellations_last30,
      (
        coalesce((current_date - ll.last_date)::int, 90) * 0.3 +
        coalesce(c.cnt, 0) * 0.5 +
        case when s.balance < 5 then 2.0 else 0 end
      ) as score
    from students s
    left join teachers t on t.id = s.teacher_id
    left join last_lesson ll on ll.student_id = s.id
    left join cancellations c on c.student_id = s.id
    where s.status = 'active'
    order by score desc nulls last
    limit 30
  `;

  return (
    <AppShell title="Проблемные ученики" back={{ href: "/manager", label: "Ученики" }}>
      <p className="text-sm text-olive-gray mb-6">
        Топ 30 по композитному score: давно не занимался + много отмен + низкий баланс.
      </p>

      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.id}
            className="bg-ivory rounded-md shadow-ring p-3 flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Link href={`/teacher/student/${r.id}`} className="font-medium no-underline hover:underline">
                  {r.full_name}
                </Link>
                {r.is_charity && <Badge variant="olive">Благотворительный</Badge>}
              </div>
              <div className="text-xs text-olive-gray mt-0.5">
                {r.teacher_name ?? "без учителя"}
                {" · "}баланс {Math.max(r.balance, 0)}
                {r.days_since_last !== null ? ` · ${r.days_since_last} дн. без урока` : " · нет уроков"}
                {r.cancellations_last30 > 0 ? ` · ${r.cancellations_last30} отмен за 30 дней` : ""}
              </div>
            </div>
            <Badge variant="terracotta">score {r.score.toFixed(1)}</Badge>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
