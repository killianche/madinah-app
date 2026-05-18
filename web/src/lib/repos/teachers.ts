import { sql } from "@/lib/db";
import type { Teacher } from "@/lib/types";

export async function findActiveTeachers(): Promise<Teacher[]> {
  return sql<Teacher[]>`
    select * from teachers where status = 'active' order by full_name
  `;
}

export async function findTeacherByUserId(userId: string): Promise<Teacher | null> {
  const rows = await sql<Teacher[]>`
    select * from teachers where user_id = ${userId} limit 1
  `;
  return rows[0] ?? null;
}

export async function findTeacherById(id: string): Promise<Teacher | null> {
  const rows = await sql<Teacher[]>`
    select * from teachers where id = ${id} limit 1
  `;
  return rows[0] ?? null;
}

export interface TeacherListRow extends Teacher {
  active_students: number;
  total_lessons_30d: number;
  conducted_30d: number;
  penalty_30d: number;
  cancelled_30d: number;
  penalty_pct: number;
  cancel_pct: number;
  avg_lessons_per_student_30d: number;
  user_phone: string | null;
  user_email: string | null;
}

/** Все учителя кроме archived — для куратора. С метриками за 30 дней. */
export async function listTeachersForCurator(): Promise<TeacherListRow[]> {
  return sql<TeacherListRow[]>`
    select
      t.*,
      coalesce(s.cnt, 0)::int as active_students,
      coalesce(l.conducted, 0)::int + coalesce(l.penalty, 0)::int as total_lessons_30d,
      coalesce(l.conducted, 0)::int as conducted_30d,
      coalesce(l.penalty, 0)::int as penalty_30d,
      coalesce(l.cancelled, 0)::int as cancelled_30d,
      case when coalesce(l.conducted, 0) + coalesce(l.penalty, 0) > 0
           then round((coalesce(l.penalty, 0)::numeric * 100) /
                     (coalesce(l.conducted, 0) + coalesce(l.penalty, 0)))::int
           else 0
      end as penalty_pct,
      case when coalesce(l.conducted, 0) + coalesce(l.penalty, 0) + coalesce(l.cancelled, 0) > 0
           then round((coalesce(l.cancelled, 0)::numeric * 100) /
                     (coalesce(l.conducted, 0) + coalesce(l.penalty, 0) + coalesce(l.cancelled, 0)))::int
           else 0
      end as cancel_pct,
      case when coalesce(s.cnt, 0) > 0
           then round(((coalesce(l.conducted, 0) + coalesce(l.penalty, 0))::numeric / s.cnt)::numeric, 1)::float
           else 0
      end as avg_lessons_per_student_30d,
      u.phone as user_phone,
      u.email as user_email
    from teachers t
    left join users u on u.id = t.user_id
    left join lateral (
      select count(*)::int as cnt
      from students
      where teacher_id = t.id and status = 'active'
    ) s on true
    left join lateral (
      select
        count(*) filter (where status = 'conducted')::int as conducted,
        count(*) filter (where status = 'penalty')::int as penalty,
        count(*) filter (where status in ('cancelled_by_student','cancelled_by_teacher'))::int as cancelled
      from lessons
      where teacher_id = t.id and deleted_at is null
        and lesson_date >= current_date - 30
    ) l on true
    where t.status != 'archived'
    order by
      case t.status when 'active' then 1 when 'paused' then 2 when 'fired' then 3 else 4 end,
      t.full_name
  `;
}

export async function setTeacherStatus(
  teacherId: string,
  status: "active" | "paused" | "fired" | "archived",
  actorId: string,
): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`
      update teachers
      set status = ${status}, updated_at = now(),
          archived_at = case when ${status} = 'archived' then current_date else archived_at end
      where id = ${teacherId}
    `;
    await tx`
      insert into audit_log (actor_id, action, entity_type, entity_id, diff)
      values (${actorId}, 'teacher.set_status', 'teacher', ${teacherId},
              ${sql.json({ status })})
    `;
  });
}

export interface TeacherQualityRow {
  teacher_id: string;
  full_name: string;
  status: string;
  active_students: number;
  total_lessons_30d: number;
  conducted_30d: number;
  penalty_30d: number;
  cancelled_by_teacher_30d: number;
  cancelled_by_student_30d: number;
  penalty_pct: number;       // штраф / (conducted+penalty)
  cancel_pct: number;        // отмены / total
  dropped_last_90d: number;  // учеников бросило за 90 дней
  attention_now: number;     // активных учеников в attention сейчас
  /** Композитный «risk score» — больше = хуже */
  risk_score: number;
}

/** Метрики качества для одного учителя — для карточки учителя у куратора. */
export async function getTeacherQuality(teacherId: string): Promise<TeacherQualityRow | null> {
  const rows = await listTeacherQualityFiltered(teacherId);
  return rows[0] ?? null;
}

async function listTeacherQualityFiltered(
  teacherId: string,
): Promise<TeacherQualityRow[]> {
  return sql<TeacherQualityRow[]>`
    with l30 as (
      select teacher_id,
             count(*) filter (where status = 'conducted')::int as conducted,
             count(*) filter (where status = 'penalty')::int as penalty,
             count(*) filter (where status = 'cancelled_by_teacher')::int as ct,
             count(*) filter (where status = 'cancelled_by_student')::int as cs,
             count(*)::int as total
      from lessons
      where deleted_at is null and lesson_date >= current_date - 30
        and teacher_id = ${teacherId}
      group by teacher_id
    ),
    dropped90 as (
      select teacher_id, count(*)::int as dropped
      from students
      where status = 'dropped' and updated_at >= now() - interval '90 days'
        and teacher_id = ${teacherId}
      group by teacher_id
    ),
    attention_now as (
      select s.teacher_id, count(*)::int as cnt
      from v_student_attention v
      join students s on s.id = v.student_id
      where v.attention_kind is not null and s.status in ('active', 'paused')
        and s.teacher_id = ${teacherId}
      group by s.teacher_id
    ),
    active_s as (
      select teacher_id, count(*)::int as cnt
      from students
      where status = 'active' and teacher_id = ${teacherId}
      group by teacher_id
    )
    select
      t.id as teacher_id,
      t.full_name,
      t.status::text as status,
      coalesce(a.cnt, 0)::int as active_students,
      (coalesce(l30.conducted, 0) + coalesce(l30.penalty, 0))::int as total_lessons_30d,
      coalesce(l30.conducted, 0)::int as conducted_30d,
      coalesce(l30.penalty, 0)::int as penalty_30d,
      coalesce(l30.ct, 0)::int as cancelled_by_teacher_30d,
      coalesce(l30.cs, 0)::int as cancelled_by_student_30d,
      case when coalesce(l30.conducted, 0) + coalesce(l30.penalty, 0) > 0
           then round((coalesce(l30.penalty, 0)::numeric * 100) /
                     (coalesce(l30.conducted, 0) + coalesce(l30.penalty, 0)))::int
           else 0
      end as penalty_pct,
      case when coalesce(l30.total, 0) > 0
           then round(((coalesce(l30.ct, 0) + coalesce(l30.cs, 0))::numeric * 100) /
                     coalesce(l30.total, 0))::int
           else 0
      end as cancel_pct,
      coalesce(d.dropped, 0)::int as dropped_last_90d,
      coalesce(att.cnt, 0)::int as attention_now,
      (
        -- Штраф = ученик не пришёл, но урок засчитан → лёгкий минус (0.3).
        -- Отмена ученика → средний (1.5). Отмена учителя → тяжелее (3.0) — учитель сам сорвал урок.
        -- Бросил → 4.0. Активный в attention → 2.0.
        coalesce(l30.penalty, 0) * 0.3 +
        coalesce(l30.cs, 0) * 1.5 +
        coalesce(l30.ct, 0) * 3.0 +
        coalesce(d.dropped, 0) * 4.0 +
        coalesce(att.cnt, 0) * 2.0
      )::float as risk_score
    from teachers t
    left join l30 on l30.teacher_id = t.id
    left join dropped90 d on d.teacher_id = t.id
    left join attention_now att on att.teacher_id = t.id
    left join active_s a on a.teacher_id = t.id
    where t.id = ${teacherId}
  `;
}

export interface TeacherActiveStudent {
  id: string;
  full_name: string;
  phone: string | null;
  balance: number;
  status: string;
  last_lesson_date: Date | null;
  days_since_last: number | null;
  attention_kind: string | null; // dropped/skipping/stale/graduated
  is_low_balance: boolean;
}

/** Активные/в-паузе ученики учителя с пометками о проблемах. */
export async function listTeacherStudentsWithFlags(
  teacherId: string,
): Promise<TeacherActiveStudent[]> {
  return sql<TeacherActiveStudent[]>`
    select
      s.id, s.full_name, s.phone, s.balance::int, s.status::text as status,
      ll.last_date as last_lesson_date,
      coalesce((current_date - ll.last_date), 999)::int as days_since_last,
      v.attention_kind::text as attention_kind,
      (s.status = 'active' and s.balance <= 0) as is_low_balance
    from students s
    left join lateral (
      select max(lesson_date) as last_date from lessons
      where student_id = s.id and deleted_at is null
    ) ll on true
    left join v_student_attention v on v.student_id = s.id
    where s.teacher_id = ${teacherId}
      and s.status in ('active', 'paused')
    order by
      case when v.attention_kind is not null then 0 else 1 end,
      case when s.balance <= 0 then 0 else 1 end,
      s.full_name
  `;
}

/** Метрики качества работы учителей за 30 дней. */
export async function listTeacherQuality(): Promise<TeacherQualityRow[]> {
  return sql<TeacherQualityRow[]>`
    with l30 as (
      select teacher_id,
             count(*) filter (where status = 'conducted')::int as conducted,
             count(*) filter (where status = 'penalty')::int as penalty,
             count(*) filter (where status = 'cancelled_by_teacher')::int as ct,
             count(*) filter (where status = 'cancelled_by_student')::int as cs,
             count(*)::int as total
      from lessons
      where deleted_at is null and lesson_date >= current_date - 30
      group by teacher_id
    ),
    dropped90 as (
      select teacher_id, count(*)::int as dropped
      from students
      where status = 'dropped' and updated_at >= now() - interval '90 days'
      group by teacher_id
    ),
    attention_now as (
      select s.teacher_id, count(*)::int as cnt
      from v_student_attention v
      join students s on s.id = v.student_id
      where v.attention_kind is not null and s.status in ('active', 'paused')
      group by s.teacher_id
    ),
    active_s as (
      select teacher_id, count(*)::int as cnt
      from students
      where status = 'active'
      group by teacher_id
    )
    select
      t.id as teacher_id,
      t.full_name,
      t.status::text as status,
      coalesce(a.cnt, 0)::int as active_students,
      (coalesce(l30.conducted, 0) + coalesce(l30.penalty, 0))::int as total_lessons_30d,
      coalesce(l30.conducted, 0)::int as conducted_30d,
      coalesce(l30.penalty, 0)::int as penalty_30d,
      coalesce(l30.ct, 0)::int as cancelled_by_teacher_30d,
      coalesce(l30.cs, 0)::int as cancelled_by_student_30d,
      case when coalesce(l30.conducted, 0) + coalesce(l30.penalty, 0) > 0
           then round((coalesce(l30.penalty, 0)::numeric * 100) /
                     (coalesce(l30.conducted, 0) + coalesce(l30.penalty, 0)))::int
           else 0
      end as penalty_pct,
      case when coalesce(l30.total, 0) > 0
           then round(((coalesce(l30.ct, 0) + coalesce(l30.cs, 0))::numeric * 100) /
                     coalesce(l30.total, 0))::int
           else 0
      end as cancel_pct,
      coalesce(d.dropped, 0)::int as dropped_last_90d,
      coalesce(att.cnt, 0)::int as attention_now,
      (
        coalesce(l30.penalty, 0) * 0.3 +
        coalesce(l30.cs, 0) * 1.5 +
        coalesce(l30.ct, 0) * 3.0 +
        coalesce(d.dropped, 0) * 4.0 +
        coalesce(att.cnt, 0) * 2.0
      )::float as risk_score
    from teachers t
    left join l30 on l30.teacher_id = t.id
    left join dropped90 d on d.teacher_id = t.id
    left join attention_now att on att.teacher_id = t.id
    left join active_s a on a.teacher_id = t.id
    where t.status in ('active', 'paused')
    order by risk_score desc, t.full_name
  `;
}

/**
 * Переводит всех активных учеников от одного учителя к другому одной транзакцией.
 * Если to_teacher = null — ученики становятся «без учителя» (попадут в очередь куратора).
 */
export async function reassignAllStudents(
  fromTeacherId: string,
  toTeacherId: string | null,
  actorId: string,
): Promise<number> {
  return sql.begin(async (tx) => {
    const updated = await tx<Array<{ id: string }>>`
      update students
      set teacher_id = ${toTeacherId}, updated_at = now()
      where teacher_id = ${fromTeacherId}
        and status in ('active', 'paused')
      returning id
    `;
    if (updated.length > 0) {
      await tx`
        insert into audit_log (actor_id, action, entity_type, entity_id, diff)
        values (${actorId}, 'teacher.bulk_reassign', 'teacher', ${fromTeacherId},
                ${sql.json({
                  to_teacher_id: toTeacherId,
                  student_count: updated.length,
                })})
      `;
    }
    return updated.length;
  });
}
