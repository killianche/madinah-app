import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { checkSalesToken } from "../_helpers";

export const dynamic = "force-dynamic";

interface SummaryRow {
  total_students: number;
  active_students: number;
  low_balance_count: number;
  new_students_in_period: number;
  left_students_in_period: number;
  prepaid_lessons_total: number;
  teacher_rate_conducted: number;
  conducted_lessons_in_period: number;
  topups_count_in_period: number;
  topups_lessons_in_period: number;
  active_teachers: number;
}

interface TeacherRow {
  teacher_id: string;
  teacher_name: string;
  lessons_in_period: number;
}

/**
 * GET /api/integrations/sales/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Сводные метрики Quran за период. Если from/to не заданы — без фильтра по периоду
 * (для total / active / low_balance).
 */
export async function GET(req: NextRequest) {
  const auth = checkSalesToken(req);
  if (auth) return auth;

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const hasRange = !!from && !!to;

  const rows = await sql<SummaryRow[]>`
    select
      (select count(*)::int from students where deleted_at is null) as total_students,
      (select count(*)::int from students where deleted_at is null and status = 'active') as active_students,
      (select count(*)::int from students where deleted_at is null and status = 'active' and balance <= 4) as low_balance_count,
      ${hasRange
        ? sql`(select count(*)::int from students where deleted_at is null and enrolled_at >= ${from}::date and enrolled_at <= ${to}::date)`
        : sql`0::int`} as new_students_in_period,
      ${hasRange
        ? sql`(select count(*)::int from students where status in ('dropped','closed','archived') and updated_at::date >= ${from}::date and updated_at::date <= ${to}::date)`
        : sql`0::int`} as left_students_in_period,
      ${hasRange
        ? sql`(select count(*)::int from lessons where deleted_at is null and status in ('conducted', 'penalty') and lesson_date >= ${from}::date and lesson_date <= ${to}::date)`
        : sql`0::int`} as conducted_lessons_in_period,
      ${hasRange
        ? sql`(select count(*)::int from balance_topups where created_at::date >= ${from}::date and created_at::date <= ${to}::date and lessons_added > 0)`
        : sql`0::int`} as topups_count_in_period,
      ${hasRange
        ? sql`(select coalesce(sum(lessons_added), 0)::int from balance_topups where created_at::date >= ${from}::date and created_at::date <= ${to}::date and lessons_added > 0)`
        : sql`0::int`} as topups_lessons_in_period,
      (select count(*)::int from teachers where status = 'active') as active_teachers,
      (select coalesce(sum(balance),0)::int from students where deleted_at is null and status = 'active' and balance > 0) as prepaid_lessons_total,
      (select coalesce(rate_conducted,0)::numeric::float8 from school_settings order by id limit 1) as teacher_rate_conducted
  `;

  // Список учителей с количеством проведённых уроков за период
  let teachers: TeacherRow[] = [];
  if (hasRange) {
    teachers = await sql<TeacherRow[]>`
      select t.id as teacher_id, t.full_name as teacher_name,
             count(l.id)::int as lessons_in_period
      from teachers t
      left join lessons l on l.teacher_id = t.id
        and l.deleted_at is null
        and l.status in ('conducted', 'penalty')
        and l.lesson_date >= ${from}::date and l.lesson_date <= ${to}::date
      where t.status = 'active'
      group by t.id, t.full_name
      order by count(l.id) desc nulls last, t.full_name
    `;
  }

  return NextResponse.json({ ...rows[0], teachers });
}
