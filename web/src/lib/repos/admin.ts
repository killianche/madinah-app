import { unstable_cache } from "next/cache";
import { sql } from "@/lib/db";

export interface AdminOverviewKPI {
  active_students: number;
  active_teachers: number;
  lessons_30d: number;
  conducted_30d: number;
  penalty_30d: number;
  cancelled_30d: number;
  new_students_30d: number;
  attendance_pct: number; // среднее за 30 дней
  payroll_30d: number;    // общий ФОТ за 30 дней по дефолтным ставкам
  prev_lessons_30d: number;
  prev_payroll_30d: number;
}

export async function getAdminOverviewKPI(): Promise<AdminOverviewKPI> {
  const rows = await sql<Array<AdminOverviewKPI>>`
    with l30 as (
      select
        count(*) filter (where status = 'conducted')::int as conducted,
        count(*) filter (where status = 'penalty')::int as penalty,
        count(*) filter (where status in ('cancelled_by_student', 'cancelled_by_teacher'))::int as cancelled,
        count(*)::int as total
      from lessons
      where deleted_at is null and lesson_date >= current_date - 30
    ),
    l_prev as (
      select count(*)::int as total,
             count(*) filter (where status = 'conducted')::int as conducted,
             count(*) filter (where status = 'penalty')::int as penalty
      from lessons
      where deleted_at is null
        and lesson_date >= current_date - 60
        and lesson_date < current_date - 30
    ),
    settings as (select rate_conducted, rate_penalty from school_settings where id = 1),
    payroll_30 as (
      select coalesce(sum(
        case
          when l.status = 'conducted' then coalesce(t.rate_conducted, s.rate_conducted)
          when l.status = 'penalty'   then coalesce(t.rate_penalty,   s.rate_penalty)
          else 0
        end
      ), 0)::float as total
      from lessons l
      join teachers t on t.id = l.teacher_id
      cross join settings s
      where l.deleted_at is null
        and l.lesson_date >= current_date - 30
        and l.status in ('conducted', 'penalty')
    ),
    payroll_prev as (
      select coalesce(sum(
        case
          when l.status = 'conducted' then coalesce(t.rate_conducted, s.rate_conducted)
          when l.status = 'penalty'   then coalesce(t.rate_penalty,   s.rate_penalty)
          else 0
        end
      ), 0)::float as total
      from lessons l
      join teachers t on t.id = l.teacher_id
      cross join settings s
      where l.deleted_at is null
        and l.lesson_date >= current_date - 60
        and l.lesson_date < current_date - 30
        and l.status in ('conducted', 'penalty')
    ),
    new_s as (
      select count(*)::int as cnt from students where enrolled_at >= current_date - 30
    ),
    active_s as (select count(*)::int as cnt from students where status = 'active'),
    active_t as (select count(*)::int as cnt from teachers where status = 'active')
    select
      (select cnt from active_s) as active_students,
      (select cnt from active_t) as active_teachers,
      (l30.conducted + l30.penalty) as lessons_30d,
      l30.conducted as conducted_30d,
      l30.penalty as penalty_30d,
      l30.cancelled as cancelled_30d,
      (select cnt from new_s) as new_students_30d,
      case when l30.conducted + l30.penalty + l30.cancelled > 0
           then round((l30.conducted::numeric * 100) / (l30.conducted + l30.penalty + l30.cancelled), 1)::float
           else 0
      end as attendance_pct,
      (select total from payroll_30) as payroll_30d,
      (l_prev.conducted + l_prev.penalty) as prev_lessons_30d,
      (select total from payroll_prev) as prev_payroll_30d
    from l30, l_prev
  `;
  return rows[0]!;
}

export async function getAdminLessonsByDay(days = 30): Promise<
  Array<{ date: string; conducted: number; penalty: number; cancelled: number }>
> {
  return sql<Array<{ date: string; conducted: number; penalty: number; cancelled: number }>>`
    with d as (
      select generate_series(current_date - ${days}::int, current_date, interval '1 day')::date as day
    )
    select
      to_char(d.day, 'YYYY-MM-DD') as date,
      coalesce(count(l.*) filter (where l.status = 'conducted'), 0)::int as conducted,
      coalesce(count(l.*) filter (where l.status = 'penalty'), 0)::int as penalty,
      coalesce(count(l.*) filter (where l.status in ('cancelled_by_student','cancelled_by_teacher')), 0)::int as cancelled
    from d
    left join lessons l on l.lesson_date = d.day and l.deleted_at is null
    group by d.day
    order by d.day
  `;
}

export interface TeacherSalaryRow {
  teacher_id: string;
  full_name: string;
  status: string;
  rate_conducted: number;
  rate_penalty: number;
  conducted: number;
  penalty: number;
  cancelled: number;
  earned: number;
}

/** Срез зарплаты по конкретному полумесяцу — для одного учителя/одной строки.
 *  half='all' используется только в клиентском агрегате (сложение first+second). */
export interface SalaryHalfMonthBucket {
  teacher_id: string;
  full_name: string;
  status: string;
  rate_conducted: number;
  rate_penalty: number;
  year: number;
  month: number;
  half: "first" | "second" | "all";
  conducted: number;
  penalty: number;
  cancelled: number;
  earned: number;
}

/**
 * Зарплата по всем учителям, агрегированная по полумесяцам за последние N месяцев.
 * Один SQL — один проход. Дальше клиент переключает периоды без серверных запросов.
 *
 * Кэш на 5 минут (unstable_cache), tag `salary` — инвалидируется при смене ставок.
 */
async function getAllSalariesByHalfMonthRaw(
  monthsBack = 12,
): Promise<SalaryHalfMonthBucket[]> {
  return sql<SalaryHalfMonthBucket[]>`
    with settings as (
      select rate_conducted, rate_penalty from school_settings where id = 1
    )
    select
      t.id as teacher_id,
      t.full_name,
      t.status::text as status,
      coalesce(t.rate_conducted, s.rate_conducted)::float as rate_conducted,
      coalesce(t.rate_penalty,   s.rate_penalty)::float as rate_penalty,
      extract(year from l.lesson_date)::int as year,
      extract(month from l.lesson_date)::int as month,
      (case when extract(day from l.lesson_date) <= 15 then 'first' else 'second' end) as half,
      count(*) filter (where l.status = 'conducted')::int as conducted,
      count(*) filter (where l.status = 'penalty')::int as penalty,
      count(*) filter (where l.status in ('cancelled_by_student','cancelled_by_teacher'))::int as cancelled,
      (
        count(*) filter (where l.status = 'conducted') * coalesce(t.rate_conducted, s.rate_conducted) +
        count(*) filter (where l.status = 'penalty')   * coalesce(t.rate_penalty,   s.rate_penalty)
      )::float as earned
    from lessons l
    join teachers t on t.id = l.teacher_id
    cross join settings s
    where l.deleted_at is null
      and l.lesson_date >= date_trunc('month', current_date - (${monthsBack}::int * interval '1 month'))::date
      and t.status in ('active', 'paused')
    group by
      t.id, t.full_name, t.status,
      t.rate_conducted, t.rate_penalty, s.rate_conducted, s.rate_penalty,
      year, month, half
    order by year desc, month desc, half desc, earned desc
  `;
}

export const getAllSalariesByHalfMonth = unstable_cache(
  getAllSalariesByHalfMonthRaw,
  ["salaries-half-month"],
  { revalidate: 300, tags: ["salary"] },
);

/** Зарплата учителей за период (days). Использует override-ставки или дефолты. */
export async function getTeacherSalaries(
  fromDate: string,
  toDate: string,
): Promise<TeacherSalaryRow[]> {
  return sql<TeacherSalaryRow[]>`
    with settings as (select rate_conducted, rate_penalty from school_settings where id = 1),
    agg as (
      select
        l.teacher_id,
        count(*) filter (where l.status = 'conducted')::int as conducted,
        count(*) filter (where l.status = 'penalty')::int as penalty,
        count(*) filter (where l.status in ('cancelled_by_student','cancelled_by_teacher'))::int as cancelled
      from lessons l
      where l.deleted_at is null
        and l.lesson_date between ${fromDate}::date and ${toDate}::date
      group by l.teacher_id
    )
    select
      t.id as teacher_id,
      t.full_name,
      t.status::text as status,
      coalesce(t.rate_conducted, s.rate_conducted)::float as rate_conducted,
      coalesce(t.rate_penalty,   s.rate_penalty)::float as rate_penalty,
      coalesce(a.conducted, 0)::int as conducted,
      coalesce(a.penalty, 0)::int as penalty,
      coalesce(a.cancelled, 0)::int as cancelled,
      (
        coalesce(a.conducted, 0) * coalesce(t.rate_conducted, s.rate_conducted) +
        coalesce(a.penalty, 0) * coalesce(t.rate_penalty, s.rate_penalty)
      )::float as earned
    from teachers t
    cross join settings s
    left join agg a on a.teacher_id = t.id
    where t.status in ('active', 'paused')
    order by earned desc, t.full_name
  `;
}

/** Зарплата одного учителя помесячно за N месяцев. */
export async function getTeacherSalaryByMonth(
  teacherId: string,
  months = 12,
): Promise<Array<{ month: string; conducted: number; penalty: number; earned: number }>> {
  return sql<Array<{ month: string; conducted: number; penalty: number; earned: number }>>`
    with settings as (select rate_conducted, rate_penalty from school_settings where id = 1),
    months as (
      select generate_series(
        date_trunc('month', current_date - (${months}::int - 1) * interval '1 month'),
        date_trunc('month', current_date),
        interval '1 month'
      )::date as m
    )
    select
      to_char(m.m, 'YYYY-MM') as month,
      coalesce(count(l.*) filter (where l.status = 'conducted'), 0)::int as conducted,
      coalesce(count(l.*) filter (where l.status = 'penalty'), 0)::int as penalty,
      (
        coalesce(count(l.*) filter (where l.status = 'conducted'), 0) * coalesce(t.rate_conducted, s.rate_conducted) +
        coalesce(count(l.*) filter (where l.status = 'penalty'), 0) * coalesce(t.rate_penalty, s.rate_penalty)
      )::float as earned
    from months m
    cross join settings s
    join teachers t on t.id = ${teacherId}
    left join lessons l on l.teacher_id = ${teacherId}
      and l.deleted_at is null
      and l.lesson_date >= m.m
      and l.lesson_date < m.m + interval '1 month'
    group by m.m, t.rate_conducted, t.rate_penalty, s.rate_conducted, s.rate_penalty
    order by m.m
  `;
}

/** Зарплата одного учителя по полумесяцам за последние N месяцев (включая текущий). */
export async function getTeacherSalaryPeriods(
  teacherId: string,
  monthsBack = 3,
): Promise<SalaryHalfMonthBucket[]> {
  return sql<SalaryHalfMonthBucket[]>`
    with settings as (
      select rate_conducted, rate_penalty from school_settings where id = 1
    )
    select
      t.id as teacher_id,
      t.full_name,
      t.status::text as status,
      coalesce(t.rate_conducted, s.rate_conducted)::float as rate_conducted,
      coalesce(t.rate_penalty,   s.rate_penalty)::float   as rate_penalty,
      extract(year  from l.lesson_date)::int as year,
      extract(month from l.lesson_date)::int as month,
      (case when extract(day from l.lesson_date) <= 15 then 'first' else 'second' end) as half,
      count(*) filter (where l.status = 'conducted')::int as conducted,
      count(*) filter (where l.status = 'penalty')::int   as penalty,
      count(*) filter (where l.status in ('cancelled_by_student','cancelled_by_teacher'))::int as cancelled,
      (
        count(*) filter (where l.status = 'conducted') * coalesce(t.rate_conducted, s.rate_conducted) +
        count(*) filter (where l.status = 'penalty')   * coalesce(t.rate_penalty,   s.rate_penalty)
      )::float as earned
    from lessons l
    join teachers t on t.id = ${teacherId}
    cross join settings s
    where l.deleted_at is null
      and l.teacher_id = ${teacherId}
      and l.lesson_date >= date_trunc('month', current_date - (${monthsBack}::int * interval '1 month'))::date
    group by
      t.id, t.full_name, t.status,
      t.rate_conducted, t.rate_penalty, s.rate_conducted, s.rate_penalty,
      year, month, half
    order by year desc, month desc, half desc
  `;
}

export interface SchoolAnalytics {
  // По периодам
  daily: Array<{ date: string; conducted: number; penalty: number; cancelled: number; new_students: number }>;
  weekly_unique_students: Array<{ week: string; unique_students: number }>;
  // Распределения
  status_distribution: Array<{ status: string; count: number }>;
  balance_distribution: Array<{ bucket: string; count: number }>;
  // Сводные
  retention_30d: { students_30d_ago: number; still_active: number; pct: number };
  avg_lessons_per_student_30d: number;
  total_active: number;
  total_dropped: number;
}

/** Cached аналитика (TTL 5 минут). При деплое новой версии — кэш сбрасывается естественно. */
export const getSchoolAnalytics = unstable_cache(
  getSchoolAnalyticsRaw,
  ["school-analytics"],
  { revalidate: 300, tags: ["analytics"] },
);

async function getSchoolAnalyticsRaw(daysBack = 90): Promise<SchoolAnalytics> {
  const [daily, weekly, status, balance, retention, avg, totals] = await Promise.all([
    sql<Array<{ date: string; conducted: number; penalty: number; cancelled: number; new_students: number }>>`
      with d as (
        select generate_series(current_date - ${daysBack}::int, current_date, interval '1 day')::date as day
      )
      select
        to_char(d.day, 'YYYY-MM-DD') as date,
        coalesce(count(l.*) filter (where l.status = 'conducted'), 0)::int as conducted,
        coalesce(count(l.*) filter (where l.status = 'penalty'), 0)::int as penalty,
        coalesce(count(l.*) filter (where l.status in ('cancelled_by_student','cancelled_by_teacher')), 0)::int as cancelled,
        coalesce(ns.cnt, 0)::int as new_students
      from d
      left join lessons l on l.lesson_date = d.day and l.deleted_at is null
      left join lateral (
        select count(*)::int as cnt from students where enrolled_at::date = d.day
      ) ns on true
      group by d.day, ns.cnt
      order by d.day
    `,
    sql<Array<{ week: string; unique_students: number }>>`
      with weeks as (
        select generate_series(
          date_trunc('week', current_date - ${daysBack}::int),
          date_trunc('week', current_date),
          interval '1 week'
        )::date as w
      )
      select
        to_char(weeks.w, 'YYYY-MM-DD') as week,
        coalesce(count(distinct l.student_id), 0)::int as unique_students
      from weeks
      left join lessons l on l.deleted_at is null
        and l.status in ('conducted', 'penalty')
        and l.lesson_date >= weeks.w
        and l.lesson_date < weeks.w + interval '1 week'
      group by weeks.w
      order by weeks.w
    `,
    sql<Array<{ status: string; count: number }>>`
      select status::text, count(*)::int from students group by status order by count(*) desc
    `,
    sql<Array<{ bucket: string; count: number }>>`
      select
        case
          when balance <= 0 then '≤ 0'
          when balance < 5 then '1-4'
          when balance < 10 then '5-9'
          when balance < 20 then '10-19'
          when balance < 40 then '20-39'
          else '40+'
        end as bucket,
        count(*)::int
      from students where status = 'active'
      group by bucket
      order by min(balance)
    `,
    sql<Array<{ students_30d_ago: number; still_active: number }>>`
      with cohort as (
        select id from students where enrolled_at <= current_date - 30
      )
      select
        (select count(*)::int from cohort) as students_30d_ago,
        (select count(*)::int from students where id in (select id from cohort) and status in ('active', 'paused')) as still_active
    `,
    sql<Array<{ avg: number }>>`
      select coalesce(round(avg(cnt)::numeric, 1), 0)::float as avg
      from (
        select count(*)::int as cnt
        from lessons
        where deleted_at is null
          and status in ('conducted', 'penalty')
          and lesson_date >= current_date - 30
        group by student_id
      ) t
    `,
    sql<Array<{ total_active: number; total_dropped: number }>>`
      select
        (select count(*)::int from students where status = 'active') as total_active,
        (select count(*)::int from students where status = 'dropped') as total_dropped
    `,
  ]);

  const r = retention[0] ?? { students_30d_ago: 0, still_active: 0 };
  return {
    daily,
    weekly_unique_students: weekly,
    status_distribution: status,
    balance_distribution: balance,
    retention_30d: {
      students_30d_ago: r.students_30d_ago,
      still_active: r.still_active,
      pct:
        r.students_30d_ago > 0
          ? Math.round((r.still_active / r.students_30d_ago) * 1000) / 10
          : 0,
    },
    avg_lessons_per_student_30d: avg[0]?.avg ?? 0,
    total_active: totals[0]?.total_active ?? 0,
    total_dropped: totals[0]?.total_dropped ?? 0,
  };
}

/** Когорты по месяцу поступления: сколько пришло, сколько активно, сколько ушло. */
export interface CohortRow {
  month: string;
  cohort_size: number;
  still_active: number;
  dropped: number;
  graduated: number;
  retention_pct: number;
}

export const getCohortRetention = unstable_cache(
  getCohortRetentionRaw,
  ["cohort-retention"],
  { revalidate: 300, tags: ["analytics"] },
);

async function getCohortRetentionRaw(monthsBack = 12): Promise<CohortRow[]> {
  const rows = await sql<
    Array<{
      month: string;
      cohort_size: number;
      still_active: number;
      dropped: number;
      graduated: number;
    }>
  >`
    with months as (
      select generate_series(
        date_trunc('month', current_date - (${monthsBack}::int * interval '1 month')),
        date_trunc('month', current_date),
        interval '1 month'
      )::date as m
    ),
    cohort as (
      select
        date_trunc('month', s.enrolled_at)::date as m,
        count(*)::int as cohort_size,
        count(*) filter (where s.status = 'active')::int as still_active,
        count(*) filter (where s.status = 'dropped')::int as dropped,
        count(*) filter (where s.status = 'graduated')::int as graduated
      from students s
      where s.enrolled_at is not null
        and s.enrolled_at >= date_trunc('month', current_date - (${monthsBack}::int * interval '1 month'))
      group by 1
    )
    select
      to_char(months.m, 'YYYY-MM') as month,
      coalesce(c.cohort_size, 0)::int as cohort_size,
      coalesce(c.still_active, 0)::int as still_active,
      coalesce(c.dropped, 0)::int as dropped,
      coalesce(c.graduated, 0)::int as graduated
    from months
    left join cohort c on c.m = months.m
    order by months.m
  `;
  return rows.map((r) => ({
    ...r,
    retention_pct:
      r.cohort_size > 0 ? Math.round((r.still_active / r.cohort_size) * 1000) / 10 : 0,
  }));
}

/** Воронка статусов: сколько учеников в каждом статусе. */
export const getStatusFunnel = unstable_cache(
  getStatusFunnelRaw,
  ["status-funnel"],
  { revalidate: 300, tags: ["analytics"] },
);

async function getStatusFunnelRaw(): Promise<
  Array<{ status: string; count: number }>
> {
  return sql<Array<{ status: string; count: number }>>`
    select status::text as status, count(*)::int as count
    from students
    group by status
    order by case status
      when 'active' then 1
      when 'paused' then 2
      when 'graduated' then 3
      when 'dropped' then 4
      when 'archived' then 5
    end
  `;
}

export async function getSchoolSettings(): Promise<{
  rate_conducted: number;
  rate_penalty: number;
  currency: string;
}> {
  const rows = await sql<
    Array<{ rate_conducted: number; rate_penalty: number; currency: string }>
  >`
    select rate_conducted::float, rate_penalty::float, currency
    from school_settings where id = 1
  `;
  return rows[0]!;
}
