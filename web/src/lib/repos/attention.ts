import { sql } from "@/lib/db";
import type { LessonStatus, StudentStatus } from "@/lib/types";
import type { AttentionKind, AttentionReviewState } from "./students";

export interface CategorySummary {
  kind:
    | "dropped"
    | "skipping"
    | "stale"
    | "graduated"
    | "low_balance"
    | "problems"
    | "no_first_lesson";
  total: number;
  new_count: number;
  in_progress_count: number;
  resolved_count: number;
}

export interface UrgentItem {
  student_id: string;
  student_name: string;
  teacher_name: string | null;
  attention_kind: AttentionKind;
  days_since_last_lesson: number;
  last_lesson_date: Date | null;
  phone: string | null;
}

/** Срочные кейсы: бросили или начали пропускать, последний ПРОВЕДЁННЫЙ урок ≤ 3 дней. */
export async function listUrgentAttention(): Promise<UrgentItem[]> {
  return sql<UrgentItem[]>`
    select
      v.student_id,
      v.student_name,
      v.teacher_name,
      v.attention_kind,
      v.phone,
      v.last_conducted_date as last_lesson_date,
      coalesce((current_date - v.last_conducted_date), 999)::int as days_since_last_lesson
    from v_student_attention v
    left join attention_review ar on ar.student_id = v.student_id
    where v.attention_kind in ('dropped', 'skipping')
      and (ar.state is null or ar.snapshot_kind is distinct from v.attention_kind::text)
      and v.last_conducted_date is not null
      and v.last_conducted_date >= current_date - 3
    order by v.last_conducted_date desc nulls last, v.student_name
    limit 8
  `;
}

/** Сводка по категориям: для дашборда.
 *  Фокус — те, с кем ещё можно работать: skipping, stale, low_balance, problems.
 *  Параметр periodDays ограничивает «свежесть» (по последнему уроку) — по умолчанию 30.
 *  dropped всегда берёт более жёсткий cap min(periodDays, 10). */
export async function getAttentionDashboardSummary(periodDays = 30): Promise<CategorySummary[]> {
  const droppedCap = Math.min(periodDays, 10);
  const kindRows = await sql<
    Array<{
      kind: AttentionKind;
      total: number;
      new_count: number;
      in_progress_count: number;
      resolved_count: number;
    }>
  >`
    with valid as (
      select
        v.student_id,
        v.attention_kind as kind,
        ar.state,
        (ar.state is not null
          and ar.snapshot_kind = v.attention_kind::text
          and ar.snapshot_status = v.status::text
          and coalesce(ar.snapshot_last_lesson_date, '1900-01-01'::date)
              = coalesce(v.last_any_lesson_date, '1900-01-01'::date)
          and date_trunc('milliseconds', ar.snapshot_student_updated_at) = date_trunc('milliseconds', s.updated_at)
        ) as is_valid
      from v_student_attention v
      join students s on s.id = v.student_id
      left join attention_review ar on ar.student_id = v.student_id
      where v.last_conducted_date is not null
        and (
          (v.attention_kind in ('skipping', 'stale')
             and v.last_conducted_date >= current_date - ${periodDays}::int)
          or
          (v.attention_kind = 'dropped'
             and v.last_conducted_date >= current_date - ${droppedCap}::int)
        )
    )
    select
      kind,
      count(*)::int as total,
      count(*) filter (where state is null or not is_valid)::int as new_count,
      count(*) filter (where state = 'in_progress' and is_valid)::int as in_progress_count,
      count(*) filter (where state = 'resolved' and is_valid)::int as resolved_count
    from valid
    group by kind
  `;

  const lowBalanceRow = await sql<Array<{ total: number }>>`
    with last_conducted as (
      select student_id, max(lesson_date) as last_date
      from lessons
      where deleted_at is null and status = 'conducted'
      group by student_id
    )
    select count(*)::int as total
    from students s
    left join last_conducted ll on ll.student_id = s.id
    where s.status = 'active'
      and s.balance <= 0
      and ll.last_date is not null
      and ll.last_date >= current_date - ${periodDays}::int
  `;

  const problemsRow = await sql<Array<{ total: number }>>`
    with last_conducted as (
      select student_id, max(lesson_date) as last_date
      from lessons
      where deleted_at is null and status = 'conducted'
      group by student_id
    ),
    cancellations as (
      select student_id, count(*)::int as cnt
      from lessons
      where status in ('cancelled_by_student', 'cancelled_by_teacher')
        and deleted_at is null
        and lesson_date >= current_date - interval '30 days'
      group by student_id
    )
    select count(*)::int as total
    from students s
    left join last_conducted ll on ll.student_id = s.id
    left join cancellations c on c.student_id = s.id
    where s.status = 'active'
      and ll.last_date is not null
      and ll.last_date >= current_date - ${periodDays}::int
      and (
        (current_date - ll.last_date) >= 14
        or coalesce(c.cnt, 0) >= 3
        or s.balance < 5
      )
  `;

  const out: CategorySummary[] = [];
  const kinds: AttentionKind[] = ["dropped", "skipping", "stale"];
  for (const k of kinds) {
    const found = kindRows.find((r) => r.kind === k);
    out.push({
      kind: k as CategorySummary["kind"],
      total: found?.total ?? 0,
      new_count: found?.new_count ?? 0,
      in_progress_count: found?.in_progress_count ?? 0,
      resolved_count: found?.resolved_count ?? 0,
    });
  }
  out.push({
    kind: "low_balance",
    total: lowBalanceRow[0]?.total ?? 0,
    new_count: lowBalanceRow[0]?.total ?? 0,
    in_progress_count: 0,
    resolved_count: 0,
  });
  out.push({
    kind: "problems",
    total: problemsRow[0]?.total ?? 0,
    new_count: problemsRow[0]?.total ?? 0,
    in_progress_count: 0,
    resolved_count: 0,
  });

  // П1: новые ученики, у которых не было ни одного проведённого урока,
  // и они в системе уже больше 5 дней.
  const noFirstLesson = await sql<Array<{ total: number }>>`
    with first_conducted as (
      select student_id, min(lesson_date) as d
      from lessons
      where deleted_at is null and status = 'conducted'
      group by student_id
    )
    select count(*)::int as total
    from students s
    left join first_conducted fc on fc.student_id = s.id
    where s.status = 'active'
      and fc.d is null
      and s.enrolled_at is not null
      and s.enrolled_at <= current_date - 5
      and s.enrolled_at >= current_date - 90
  `;
  out.push({
    kind: "no_first_lesson",
    total: noFirstLesson[0]?.total ?? 0,
    new_count: noFirstLesson[0]?.total ?? 0,
    in_progress_count: 0,
    resolved_count: 0,
  });

  return out;
}

/** Список новых учеников без первого проведённого урока (П1). */
export async function listNoFirstLesson(): Promise<CategoryRow[]> {
  const rows = await sql<Array<Omit<CategoryRow, "bucket">>>`
    select
      s.id as student_id, s.full_name as student_name, s.phone,
      s.teacher_id, t.full_name as teacher_name, s.status,
      s.balance::int,
      null::text as attention_kind,
      null::date as last_any_lesson_date,
      null::date as last_conducted_date,
      null::lesson_status[] as last_3_statuses,
      coalesce((current_date - s.enrolled_at), 999)::int as days_since_last,
      null as review_state,
      null as review_note,
      null as review_actor_name,
      null as review_updated_at,
      s.updated_at as student_updated_at,
      false as review_valid
    from students s
    left join teachers t on t.id = s.teacher_id
    left join lateral (
      select 1 from lessons
      where student_id = s.id and deleted_at is null and status = 'conducted'
      limit 1
    ) any_conducted on true
    where s.status = 'active'
      and any_conducted is null
      and s.enrolled_at is not null
      and s.enrolled_at <= current_date - 5
      and s.enrolled_at >= current_date - 90
    order by s.enrolled_at asc, s.full_name
    limit 200
  `;
  return rows.map((r) => ({ ...r, bucket: bucketFor(r.days_since_last) }));
}

export interface CategoryRow {
  student_id: string;
  student_name: string;
  phone: string | null;
  teacher_id: string | null;
  teacher_name: string | null;
  status: StudentStatus;
  balance: number;
  attention_kind: AttentionKind | null;
  last_any_lesson_date: Date | null;
  last_conducted_date: Date | null;
  last_3_statuses: LessonStatus[] | null;
  days_since_last: number | null;
  review_state: AttentionReviewState | null;
  review_note: string | null;
  review_actor_name: string | null;
  review_updated_at: Date | null;
  review_valid: boolean;
  student_updated_at: Date;
  /** свежесть для приоритезации */
  bucket: "fresh" | "week" | "older";
}

function bucketFor(daysSinceLast: number | null): "fresh" | "week" | "older" {
  if (daysSinceLast === null) return "older";
  if (daysSinceLast <= 7) return "fresh";
  if (daysSinceLast <= 30) return "week";
  return "older";
}

/** Список одной категории attention_kind.
 *  dropped ограничен 10 днями (свежие — есть шанс вернуть),
 *  остальные — 30 днями. Считаем по дате ПОСЛЕДНЕГО ПРОВЕДЁННОГО урока —
 *  только так измеряется реальное участие ученика (штраф/отмена не считается). */
export async function listAttentionByKind(
  kind: AttentionKind,
): Promise<CategoryRow[]> {
  const cap = kind === "dropped" ? 10 : 30;
  const rows = await sql<Array<Omit<CategoryRow, "bucket"> & { balance: number }>>`
    select
      v.student_id, v.student_name, v.phone,
      v.teacher_id, v.teacher_name, v.status,
      s.balance::int,
      v.attention_kind,
      v.last_any_lesson_date, v.last_conducted_date, v.last_3_statuses,
      coalesce((current_date - v.last_conducted_date), 999)::int as days_since_last,
      ar.state as review_state,
      ar.note as review_note,
      u.full_name as review_actor_name,
      ar.updated_at as review_updated_at,
      s.updated_at as student_updated_at,
      (
        ar.state is not null
        and ar.snapshot_kind = v.attention_kind::text
        and ar.snapshot_status = v.status::text
        and coalesce(ar.snapshot_last_lesson_date, '1900-01-01'::date)
            = coalesce(v.last_any_lesson_date, '1900-01-01'::date)
        and date_trunc('milliseconds', ar.snapshot_student_updated_at) = date_trunc('milliseconds', s.updated_at)
      ) as review_valid
    from v_student_attention v
    join students s on s.id = v.student_id
    left join attention_review ar on ar.student_id = v.student_id
    left join users u on u.id = ar.actor_id
    where v.attention_kind = ${kind}
      and v.last_conducted_date is not null
      and v.last_conducted_date >= current_date - ${cap}::int
    order by v.last_conducted_date desc nulls last, v.student_name
  `;
  return rows.map((r) => ({ ...r, bucket: bucketFor(r.days_since_last) }));
}

/** Список «Низкий баланс» — active + balance<=0. */
export async function listLowBalance(): Promise<CategoryRow[]> {
  const rows = await sql<Array<Omit<CategoryRow, "bucket">>>`
    select
      s.id as student_id, s.full_name as student_name, s.phone,
      s.teacher_id, t.full_name as teacher_name, s.status,
      s.balance::int,
      null::text as attention_kind,
      ll.last_date as last_any_lesson_date,
      lc.last_date as last_conducted_date,
      null::lesson_status[] as last_3_statuses,
      coalesce((current_date - lc.last_date), 999)::int as days_since_last,
      null as review_state,
      null as review_note,
      null as review_actor_name,
      null as review_updated_at,
      s.updated_at as student_updated_at,
      false as review_valid
    from students s
    left join teachers t on t.id = s.teacher_id
    left join lateral (select max(lesson_date) as last_date from lessons where student_id = s.id and deleted_at is null) ll on true
    left join lateral (select max(lesson_date) as last_date from lessons where student_id = s.id and deleted_at is null and status = 'conducted') lc on true
    where s.status = 'active'
      and s.balance <= 0
      and lc.last_date is not null
      and lc.last_date >= current_date - 30
    order by s.balance asc, s.full_name
    limit 200
  `;
  return rows.map((r) => ({ ...r, bucket: bucketFor(r.days_since_last) }));
}

/** Композит «Проблемные» — score-based. */
export async function listProblems(): Promise<
  Array<{
    student_id: string;
    student_name: string;
    phone: string | null;
    teacher_name: string | null;
    balance: number;
    days_since_last: number | null;
    cancellations_30d: number;
    score: number;
    is_charity: boolean;
  }>
> {
  return sql<
    Array<{
      student_id: string;
      student_name: string;
      phone: string | null;
      teacher_name: string | null;
      balance: number;
      days_since_last: number | null;
      cancellations_30d: number;
      score: number;
      is_charity: boolean;
    }>
  >`
    with last_conducted as (
      select student_id, max(lesson_date) as last_date
      from lessons
      where deleted_at is null and status = 'conducted'
      group by student_id
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
      s.id as student_id,
      s.full_name as student_name,
      s.phone,
      t.full_name as teacher_name,
      s.balance::int,
      s.is_charity,
      (current_date - ll.last_date)::int as days_since_last,
      coalesce(c.cnt, 0)::int as cancellations_30d,
      (
        coalesce((current_date - ll.last_date)::int, 90) * 0.3 +
        coalesce(c.cnt, 0) * 0.5 +
        case when s.balance < 5 then 2.0 else 0 end
      )::float as score
    from students s
    left join teachers t on t.id = s.teacher_id
    left join last_conducted ll on ll.student_id = s.id
    left join cancellations c on c.student_id = s.id
    where s.status = 'active'
      and ll.last_date is not null
      and ll.last_date >= current_date - 30
      and (
        (current_date - ll.last_date) >= 14
        or coalesce(c.cnt, 0) >= 3
        or s.balance < 5
      )
    order by score desc nulls last
    limit 100
  `;
}
