import { sql } from "@/lib/db";
import type { Student, LessonStatus, StudentStatus } from "@/lib/types";

// ========================= ATTENTION =========================

export type AttentionKind = "stale" | "skipping" | "dropped" | "graduated";

export interface StudentAttentionRow {
  student_id: string;
  student_name: string;
  phone: string | null;
  teacher_id: string | null;
  teacher_name: string | null;
  status: StudentStatus;
  last_conducted_date: Date | null;
  last_any_lesson_date: Date | null;
  last_3_statuses: LessonStatus[] | null;
  attention_kind: AttentionKind;
}

/**
 * Ученики, требующие внимания куратора: серая зона (stale/skipping) + dropped.
 * Сортировка: свежие события первыми (dropped → skipping → stale; внутри — позже по дате).
 */
/**
 * Ученики учителя с низким балансом и давно без пополнений — подсказка учителю
 * «напомни пополнить».
 */
export interface StaleTopupRow {
  student_id: string;
  student_name: string;
  balance: number;
  last_topup_date: Date | null;
  days_since_topup: number | null;
}

export async function teacherStudentsNeedTopup(
  teacherId: string,
  limit = 20,
): Promise<StaleTopupRow[]> {
  return sql<StaleTopupRow[]>`
    select
      s.id as student_id,
      s.full_name as student_name,
      s.balance::int,
      lt.d as last_topup_date,
      case when lt.d is null then null
           else (current_date - lt.d)::int
      end as days_since_topup
    from students s
    left join lateral (
      select max(created_at::date) as d
      from balance_topups
      where student_id = s.id
    ) lt on true
    where s.teacher_id = ${teacherId}
      and s.status = 'active'
      and s.balance <= 3
      and (lt.d is null or (current_date - lt.d) >= 30)
    order by s.balance, lt.d nulls first
    limit ${limit}
  `;
}

export async function listStudentsNeedingAttention(): Promise<StudentAttentionRow[]> {
  return sql<StudentAttentionRow[]>`
    select student_id, student_name, phone,
           teacher_id, teacher_name, status,
           last_conducted_date, last_any_lesson_date,
           last_3_statuses, attention_kind
    from v_student_attention
    where attention_kind is not null
    order by
      case attention_kind
        when 'dropped' then 1
        when 'skipping' then 2
        when 'stale' then 3
        when 'graduated' then 4
      end,
      coalesce(last_any_lesson_date, last_conducted_date) desc nulls last,
      student_name
  `;
}

export interface StudentAttentionFlag {
  kind: AttentionKind | null;
  last_conducted_date: Date | null;
}

/** Флаг «требует внимания» для конкретного ученика (для бейджа на карточке). */
export async function getStudentAttention(
  studentId: string,
): Promise<StudentAttentionFlag | null> {
  const rows = await sql<StudentAttentionFlag[]>`
    select attention_kind as kind, last_conducted_date
    from v_student_attention
    where student_id = ${studentId}
    limit 1
  `;
  return rows[0] ?? null;
}

// ========================= STATUS HISTORY =========================

export interface StudentStatusHistoryEntry {
  created_at: Date;
  actor_id: string | null;
  actor_name: string | null;
  old_status: StudentStatus | null;
  new_status: StudentStatus;
  reason: string | null;
}

/**
 * История смен статуса ученика — из audit_log.
 * Показывает, когда ушёл в отпуск / вернулся / бросил и т.д.
 */
export async function getStudentStatusHistory(
  studentId: string,
): Promise<StudentStatusHistoryEntry[]> {
  return sql<StudentStatusHistoryEntry[]>`
    select a.created_at,
           a.actor_id,
           u.full_name as actor_name,
           (a.diff->>'old_status')::text::student_status as old_status,
           (a.diff->>'new_status')::text::student_status as new_status,
           a.diff->>'reason' as reason
    from audit_log a
    left join users u on u.id = a.actor_id
    where a.action = 'student.change_status'
      and a.entity_type = 'student'
      and a.entity_id = ${studentId}
    order by a.created_at desc
  `;
}

export interface StudentWithTeacher extends Student {
  teacher_name: string | null;
}

export async function listStudentsByTeacher(teacherId: string): Promise<StudentWithTeacher[]> {
  const rows = await sql<StudentWithTeacher[]>`
    select s.*, t.full_name as teacher_name
    from students s
    left join teachers t on t.id = s.teacher_id
    where s.teacher_id = ${teacherId}
      and s.status in ('active', 'paused', 'graduated', 'dropped', 'archived')
    order by s.full_name
  `;
  return rows;
}

export async function listAllActiveStudents(): Promise<StudentWithTeacher[]> {
  const rows = await sql<StudentWithTeacher[]>`
    select s.*, t.full_name as teacher_name
    from students s
    left join teachers t on t.id = s.teacher_id
    where s.status in ('active', 'paused')
    order by s.full_name
    limit 500
  `;
  return rows;
}

/** Все ученики школы (включая graduated/dropped/archived) — для manager. */
export async function listAllStudentsFull(): Promise<StudentWithTeacher[]> {
  return sql<StudentWithTeacher[]>`
    select s.*, t.full_name as teacher_name
    from students s
    left join teachers t on t.id = s.teacher_id
    order by s.full_name
  `;
}

export async function findStudentById(id: string): Promise<StudentWithTeacher | null> {
  const rows = await sql<StudentWithTeacher[]>`
    select s.*, t.full_name as teacher_name
    from students s
    left join teachers t on t.id = s.teacher_id
    where s.id = ${id}
    limit 1
  `;
  return rows[0] ?? null;
}

/**
 * Баланс пересчитанный из истории. Используется для сверки и отображения.
 */
export async function getCalculatedBalance(studentId: string): Promise<number> {
  const rows = await sql<Array<{ balance: number }>>`
    select
      coalesce((select sum(lessons_added)::int from balance_topups where student_id = ${studentId}), 0)
      -
      coalesce((select count(*)::int from lessons
                where student_id = ${studentId}
                  and status in ('conducted', 'penalty')
                  and deleted_at is null), 0)
      as balance
  `;
  return rows[0]?.balance ?? 0;
}

export interface StudentTeacherStat {
  teacher_id: string;
  teacher_name: string;
  teacher_status: "active" | "archived";
  total: number;
  conducted: number;
  penalty: number;
  cancelled_by_student: number;
  cancelled_by_teacher: number;
  first_lesson_date: Date;
  last_lesson_date: Date;
}

/**
 * Разбивка уроков ученика по учителям: сколько с кем, какие статусы, период.
 * Сортировка: текущий учитель первый, остальные по last_lesson_date desc.
 */
export async function getStudentTeacherBreakdown(
  studentId: string,
  currentTeacherId: string | null,
): Promise<StudentTeacherStat[]> {
  const rows = await sql<StudentTeacherStat[]>`
    select teacher_id, teacher_name, teacher_status,
           total, conducted, penalty, cancelled_by_student, cancelled_by_teacher,
           first_lesson_date, last_lesson_date
    from v_student_teacher_stats
    where student_id = ${studentId}
    order by
      case when teacher_id = ${currentTeacherId ?? null} then 0 else 1 end,
      last_lesson_date desc
  `;
  return rows;
}

/**
 * Сменить учителя у ученика с записью в audit_log.
 */
/**
 * Сменить статус ученика (active/paused/graduated/dropped/archived).
 * При переходе в «неактивный» (не active/paused) проставляем archived_at.
 */
export async function changeStudentStatus(input: {
  student_id: string;
  new_status: "active" | "paused" | "graduated" | "dropped" | "archived";
  reason: string | null;
  actor_id: string;
}): Promise<void> {
  await sql.begin(async (tx) => {
    const prev = await tx<Array<{ status: string }>>`
      select status from students where id = ${input.student_id} for update
    `;
    const oldStatus = prev[0]?.status ?? null;

    const isArchiving = !["active", "paused"].includes(input.new_status);

    await tx`
      update students
      set status = ${input.new_status}::student_status,
          archived_at = case
            when ${isArchiving} then coalesce(archived_at, current_date)
            when ${input.new_status} = 'active' or ${input.new_status} = 'paused' then null
            else archived_at
          end,
          updated_at = now()
      where id = ${input.student_id}
    `;

    await tx`
      insert into audit_log (actor_id, action, entity_type, entity_id, diff)
      values (${input.actor_id}, 'student.change_status', 'student', ${input.student_id},
              ${sql.json({
                old_status: oldStatus,
                new_status: input.new_status,
                reason: input.reason,
              })})
    `;
  });
}

/** Обновление профиля ученика (ФИО, телефон, ТГ, charity). */
export async function updateStudentProfile(input: {
  student_id: string;
  full_name: string;
  phone: string | null;
  telegram_username: string | null;
  is_charity: boolean;
  charity_note: string | null;
  actor_id: string;
}): Promise<void> {
  await sql.begin(async (tx) => {
    const prev = await tx<Array<{
      full_name: string;
      phone: string | null;
      telegram_username: string | null;
      is_charity: boolean;
    }>>`
      select full_name, phone, telegram_username, is_charity
      from students where id = ${input.student_id} for update
    `;
    const old = prev[0];

    await tx`
      update students
      set full_name = ${input.full_name},
          phone = ${input.phone},
          telegram_username = ${input.telegram_username},
          is_charity = ${input.is_charity},
          charity_note = ${input.charity_note},
          charity_since = case
            when ${input.is_charity} and charity_since is null then current_date
            when not ${input.is_charity} then null
            else charity_since
          end,
          updated_at = now()
      where id = ${input.student_id}
    `;

    await tx`
      insert into audit_log (actor_id, action, entity_type, entity_id, diff)
      values (${input.actor_id}, 'student.update_profile', 'student', ${input.student_id},
              ${sql.json({
                old,
                new: {
                  full_name: input.full_name,
                  phone: input.phone,
                  telegram_username: input.telegram_username,
                  is_charity: input.is_charity,
                },
              })})
    `;
  });
}

export async function changeStudentTeacher(input: {
  student_id: string;
  new_teacher_id: string;
  reason: string | null;
  actor_id: string;
}): Promise<void> {
  await sql.begin(async (tx) => {
    const prev = await tx<Array<{ teacher_id: string | null }>>`
      select teacher_id from students where id = ${input.student_id} for update
    `;
    const oldTeacherId = prev[0]?.teacher_id ?? null;

    await tx`
      update students
      set teacher_id = ${input.new_teacher_id}, updated_at = now()
      where id = ${input.student_id}
    `;

    await tx`
      insert into audit_log (actor_id, action, entity_type, entity_id, diff)
      values (${input.actor_id}, 'student.change_teacher', 'student', ${input.student_id},
              ${sql.json({
                old_teacher_id: oldTeacherId,
                new_teacher_id: input.new_teacher_id,
                reason: input.reason,
              })})
    `;
  });
}

export interface StudentListItem {
  id: string;
  full_name: string;
  phone: string | null;
  balance: number;
  is_charity: boolean;
  status: StudentStatus;
  last_lesson_date: Date | null;
  last_lesson_status: LessonStatus | null;
  first_lesson_date: Date | null;
  conducted: number;
  total: number;
  attendance_pct: number | null;  // 0..100 или null если нет уроков
}

/**
 * Список учеников учителя с обогащённой аналитикой для /teacher/students.
 */
export async function teacherStudentList(teacherId: string): Promise<StudentListItem[]> {
  const rows = await sql<StudentListItem[]>`
    select
      s.id,
      s.full_name,
      s.phone,
      s.balance,
      s.is_charity,
      s.status,
      last_lesson.lesson_date as last_lesson_date,
      last_lesson.status as last_lesson_status,
      agg.first_lesson_date,
      agg.conducted::int,
      agg.total::int,
      case when agg.total > 0
           then round((agg.conducted::numeric / agg.total) * 100)::int
           else null
      end as attendance_pct
    from students s
    left join lateral (
      select lesson_date, status
      from lessons
      where student_id = s.id and deleted_at is null
      order by lesson_date desc, created_at desc
      limit 1
    ) last_lesson on true
    left join lateral (
      select
        min(lesson_date) as first_lesson_date,
        count(*) filter (where status = 'conducted')::int as conducted,
        count(*)::int as total
      from lessons
      where student_id = s.id and deleted_at is null
    ) agg on true
    where s.teacher_id = ${teacherId}
      and s.status in ('active', 'paused', 'graduated', 'dropped', 'archived')
    order by s.full_name
  `;
  return rows;
}
