import { sql } from "@/lib/db";
import type { Student, LessonStatus, StudentStatus } from "@/lib/types";

// ========================= OWNERSHIP =========================

/**
 * Проверка, что ученик принадлежит учителю с данным userId.
 * Бросает Error("not_owner"), если нет. Используется в server actions
 * до того, как трогать данные ученика.
 */
export async function assertTeacherOwnsStudent(
  userId: string,
  studentId: string,
): Promise<void> {
  const rows = await sql<Array<{ id: string }>>`
    select s.id from students s
    join teachers t on t.id = s.teacher_id
    where s.id = ${studentId} and t.user_id = ${userId} and s.deleted_at is null
    limit 1
  `;
  if (rows.length === 0) throw new Error("not_owner");
}

/**
 * Проверка, что урок принадлежит учителю с данным userId. Аналогично выше.
 */
export async function assertTeacherOwnsLesson(
  userId: string,
  lessonId: string,
): Promise<void> {
  const rows = await sql<Array<{ id: string }>>`
    select l.id from lessons l
    join teachers t on t.id = l.teacher_id
    where l.id = ${lessonId} and t.user_id = ${userId} and l.deleted_at is null
    limit 1
  `;
  if (rows.length === 0) throw new Error("not_owner");
}

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
      and s.deleted_at is null
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

export type AttentionReviewState = "in_progress" | "resolved";

export interface StudentAttentionRowWithReview extends StudentAttentionRow {
  review_state: AttentionReviewState | null;
  review_note: string | null;
  review_actor_name: string | null;
  review_updated_at: Date | null;
  /** true = отметка относится к нынешней ситуации, false = устарела (ситуация изменилась) */
  review_valid: boolean;
  /** student.updated_at — для снапшота при сохранении новой отметки */
  student_updated_at: Date;
}

/**
 * Список «Требует внимания» с состоянием обработки куратором + флаг valid:
 * true если snapshot совпадает с текущей ситуацией.
 */
export async function listAttentionWithReview(): Promise<StudentAttentionRowWithReview[]> {
  return sql<StudentAttentionRowWithReview[]>`
    select
      v.student_id, v.student_name, v.phone,
      v.teacher_id, v.teacher_name, v.status,
      v.last_conducted_date, v.last_any_lesson_date,
      v.last_3_statuses, v.attention_kind,
      s.updated_at as student_updated_at,
      ar.state as review_state,
      ar.note as review_note,
      u.full_name as review_actor_name,
      ar.updated_at as review_updated_at,
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
    where v.attention_kind is not null
    order by
      case v.attention_kind
        when 'dropped' then 1
        when 'skipping' then 2
        when 'stale' then 3
        when 'graduated' then 4
      end,
      coalesce(v.last_any_lesson_date, v.last_conducted_date) desc nulls last,
      v.student_name
  `;
}

export async function setAttentionReview(
  studentId: string,
  state: AttentionReviewState,
  note: string | null,
  actorId: string,
  snapshot: {
    kind: string;
    status: string;
    last_lesson_date: Date | null;
    student_updated_at: Date;
  },
): Promise<void> {
  await sql`
    insert into attention_review (
      student_id, state, note, actor_id, updated_at,
      snapshot_kind, snapshot_status, snapshot_last_lesson_date, snapshot_student_updated_at
    )
    values (
      ${studentId}, ${state}, ${note}, ${actorId}, now(),
      ${snapshot.kind}, ${snapshot.status},
      ${snapshot.last_lesson_date}, ${snapshot.student_updated_at}
    )
    on conflict (student_id) do update
    set state = excluded.state,
        note = excluded.note,
        actor_id = excluded.actor_id,
        updated_at = now(),
        snapshot_kind = excluded.snapshot_kind,
        snapshot_status = excluded.snapshot_status,
        snapshot_last_lesson_date = excluded.snapshot_last_lesson_date,
        snapshot_student_updated_at = excluded.snapshot_student_updated_at
  `;
}

export async function clearAttentionReview(studentId: string): Promise<void> {
  await sql`delete from attention_review where student_id = ${studentId}`;
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
  creator_name?: string | null;
}

export async function listStudentsByTeacher(teacherId: string): Promise<StudentWithTeacher[]> {
  const rows = await sql<StudentWithTeacher[]>`
    select s.*, t.full_name as teacher_name
    from students s
    left join teachers t on t.id = s.teacher_id
    where s.teacher_id = ${teacherId}
      and s.status in ('active', 'paused', 'graduated', 'dropped', 'archived')
      and s.deleted_at is null
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
      and s.deleted_at is null
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
    where s.deleted_at is null
    order by s.full_name
  `;
}

export interface ManagerStudentRow {
  id: string;
  full_name: string;
  phone: string | null;
  balance: number;
  is_charity: boolean;
  status: StudentStatus;
  teacher_id: string | null;
  teacher_name: string | null;
  enrolled_at: Date | null;
  last_lesson_date: Date | null;
  /** Засчитанные уроки = conducted + penalty (отмены не входят). */
  counted_lessons: number;
  created_by_user_id: string | null;
}

/** Полная выгрузка для /manager с last_lesson_date и enrolled_at для сортировок.
 *  Дата поступления = первый урок ученика; если уроков нет — fallback на students.enrolled_at. */
export async function listAllStudentsForManager(): Promise<ManagerStudentRow[]> {
  return sql<ManagerStudentRow[]>`
    select
      s.id, s.full_name, s.phone, s.balance::int, s.is_charity, s.status,
      s.teacher_id, t.full_name as teacher_name,
      coalesce(ll.first_lesson_date, s.enrolled_at) as enrolled_at,
      ll.last_lesson_date,
      coalesce(ll.counted, 0)::int as counted_lessons,
      s.created_by_user_id
    from students s
    left join teachers t on t.id = s.teacher_id
    left join lateral (
      select
        min(lesson_date) as first_lesson_date,
        max(lesson_date) as last_lesson_date,
        count(*) filter (where status in ('conducted', 'penalty'))::int as counted
      from lessons
      where student_id = s.id and deleted_at is null
    ) ll on true
    where s.deleted_at is null
    order by s.full_name
  `;
}

/** Дешёвая статистика по всем ученикам — для KPI strip над таблицей. */
export interface StudentsStats {
  total: number;
  active: number;
  paused: number;
  dropped: number;
  closed: number;
  no_teacher_active: number;
  neg_balance_active: number;
  low_balance_active: number;
}

export async function getStudentsStats(): Promise<StudentsStats> {
  const rows = await sql<Array<StudentsStats>>`
    select
      count(*)::int as total,
      count(*) filter (where status = 'active')::int as active,
      count(*) filter (where status = 'paused')::int as paused,
      count(*) filter (where status = 'dropped')::int as dropped,
      count(*) filter (where status = 'closed')::int as closed,
      count(*) filter (where status = 'active' and teacher_id is null)::int as no_teacher_active,
      count(*) filter (where status = 'active' and balance <= 0)::int as neg_balance_active,
      count(*) filter (where status = 'active' and balance >= 1 and balance <= 4)::int as low_balance_active
    from students
    where deleted_at is null
  `;
  return rows[0]!;
}

/** Серверный листинг с лимитом — для admin/students. Сортировка: сначала active, потом
 *  по имени. По дефолту берём 200 строк, чтобы быстро рисовать. Полное скачивание — через limit=null. */
export async function listStudentsPaged(opts: {
  limit: number | null;
  search?: string | null;
}): Promise<{ rows: ManagerStudentRow[]; total: number }> {
  const search = opts.search?.trim() ?? "";
  const totalRow = await sql<Array<{ total: number }>>`
    select count(*)::int as total
    from students s
    where s.deleted_at is null
      and ${search.length > 0 ? sql`(s.full_name ilike ${"%" + search + "%"} or s.phone ilike ${"%" + search + "%"})` : sql`true`}
  `;
  const total = totalRow[0]?.total ?? 0;

  const rows = await sql<ManagerStudentRow[]>`
    select
      s.id, s.full_name, s.phone, s.balance::int, s.is_charity, s.status,
      s.teacher_id, t.full_name as teacher_name,
      coalesce(ll.first_lesson_date, s.enrolled_at) as enrolled_at,
      ll.last_lesson_date
    from students s
    left join teachers t on t.id = s.teacher_id
    left join lateral (
      select
        min(lesson_date) as first_lesson_date,
        max(lesson_date) as last_lesson_date
      from lessons
      where student_id = s.id and deleted_at is null
    ) ll on true
    where s.deleted_at is null
      and ${search.length > 0 ? sql`(s.full_name ilike ${"%" + search + "%"} or s.phone ilike ${"%" + search + "%"})` : sql`true`}
    order by
      case s.status
        when 'active' then 1
        when 'paused' then 2
        when 'dropped' then 3
        when 'closed' then 4
        when 'graduated' then 5
        when 'archived' then 6
      end,
      s.full_name
    ${opts.limit !== null ? sql`limit ${opts.limit}` : sql``}
  `;
  return { rows, total };
}

export interface UnassignedStudentRow {
  id: string;
  full_name: string;
  phone: string | null;
  enrolled_at: Date | null;
  balance: number;
  created_by_name: string | null;
  days_unassigned: number;
}

/**
 * Ученики без учителя (active + teacher_id is null) — очередь куратора.
 * created_by_name берётся из audit_log по action='student.create'.
 */
export async function listUnassignedStudents(): Promise<UnassignedStudentRow[]> {
  return sql<UnassignedStudentRow[]>`
    select s.id,
           s.full_name,
           s.phone,
           s.enrolled_at,
           s.balance::int,
           u.full_name as created_by_name,
           greatest(0, (current_date - coalesce(s.enrolled_at::date, s.created_at::date)))::int as days_unassigned
    from students s
    left join lateral (
      select actor_id from audit_log
      where action = 'student.create' and entity_type = 'student' and entity_id = s.id
      order by created_at asc
      limit 1
    ) a on true
    left join users u on u.id = a.actor_id
    where s.teacher_id is null
      and s.status in ('active', 'paused')
      and s.deleted_at is null
    order by s.enrolled_at asc nulls first, s.full_name
  `;
}

/** Назначает ученику учителя + audit. Возвращает true если успешно. */
export async function assignTeacherToStudent(
  studentId: string,
  teacherId: string,
  actorId: string,
  schedules?: Array<{ weekday: number; time_at: string }>,
): Promise<boolean> {
  const ok = await sql.begin(async (tx) => {
    const updated = await tx<Array<{ id: string; old: string | null }>>`
      update students
      set teacher_id = ${teacherId}, updated_at = now()
      where id = ${studentId}
      returning id, (
        select s.teacher_id from students s where s.id = ${studentId}
      ) as old
    `;
    if (updated.length === 0) return false;
    await tx`
      insert into audit_log (actor_id, action, entity_type, entity_id, diff)
      values (${actorId}, 'student.assign_teacher', 'student', ${studentId},
              ${sql.json({ teacher_id: teacherId, schedules: schedules ?? [] })})
    `;
    // Логика «новый учитель = новое расписание»:
    // стираем всё старое расписание ученика, потом записываем выбранные при подборе слоты.
    // Это убирает падающий ON CONFLICT (unique-constraint deferrable несовместим с ON CONFLICT).
    if (schedules && schedules.length > 0) {
      await tx`delete from student_schedules where student_id = ${studentId}`;
      for (const slot of schedules) {
        await tx`
          insert into student_schedules (student_id, weekday, time_at, duration_min)
          values (${studentId}, ${slot.weekday}, ${slot.time_at}, 30)
        `;
      }
    }
    return true;
  });
  if (ok) {
    const { notifyTeacherAssigned } = await import("@/lib/notify");
    await notifyTeacherAssigned(studentId, teacherId, actorId);
  }
  return ok;
}

export async function findStudentById(id: string): Promise<StudentWithTeacher | null> {
  const rows = await sql<StudentWithTeacher[]>`
    select s.*, t.full_name as teacher_name, u.full_name as creator_name
    from students s
    left join teachers t on t.id = s.teacher_id
    left join users u on u.id = s.created_by_user_id
    where s.id = ${id} and s.deleted_at is null
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

/** Массовая сверка балансов: сравниваем students.balance с честным пересчётом из БД. */
export interface ReconcileEntry {
  student_id: string;
  full_name: string;
  status: StudentStatus;
  teacher_name: string | null;
  current_balance: number;
  calculated_balance: number;
  delta: number;
}

export async function getBalanceReconcile(): Promise<ReconcileEntry[]> {
  return sql<ReconcileEntry[]>`
    with topups as (
      select student_id, sum(lessons_added)::int as added
      from balance_topups
      group by student_id
    ),
    deducts as (
      select student_id, count(*)::int as cnt
      from lessons
      where status in ('conducted', 'penalty') and deleted_at is null
      group by student_id
    )
    select
      s.id as student_id,
      s.full_name,
      s.status,
      t.full_name as teacher_name,
      s.balance::int as current_balance,
      (coalesce(tp.added, 0) - coalesce(d.cnt, 0))::int as calculated_balance,
      (s.balance - (coalesce(tp.added, 0) - coalesce(d.cnt, 0)))::int as delta
    from students s
    left join teachers t on t.id = s.teacher_id
    left join topups tp on tp.student_id = s.id
    left join deducts d on d.student_id = s.id
    where s.balance != (coalesce(tp.added, 0) - coalesce(d.cnt, 0))
      and s.deleted_at is null
    order by abs(s.balance - (coalesce(tp.added, 0) - coalesce(d.cnt, 0))) desc, s.full_name
  `;
}

/** Применить честный баланс ко всем учеников с расхождением. */
export async function applyReconcile(actorId: string): Promise<{ updated: number }> {
  let updated = 0;
  await sql.begin(async (tx) => {
    const fixed = await tx<Array<{ student_id: string; old_balance: number; new_balance: number }>>`
      with topups as (
        select student_id, sum(lessons_added)::int as added from balance_topups group by student_id
      ),
      deducts as (
        select student_id, count(*)::int as cnt
        from lessons
        where status in ('conducted', 'penalty') and deleted_at is null
        group by student_id
      ),
      target as (
        select s.id as student_id,
               s.balance::int as old_balance,
               (coalesce(tp.added, 0) - coalesce(d.cnt, 0))::int as new_balance
        from students s
        left join topups tp on tp.student_id = s.id
        left join deducts d on d.student_id = s.id
        where s.balance != (coalesce(tp.added, 0) - coalesce(d.cnt, 0))
      ),
      upd as (
        update students s
        set balance = t.new_balance, updated_at = now()
        from target t
        where s.id = t.student_id
        returning s.id as student_id, t.old_balance, t.new_balance
      )
      select * from upd
    `;
    updated = fixed.length;
    if (fixed.length > 0) {
      await tx`
        insert into audit_log (actor_id, action, entity_type, entity_id, diff)
        values (${actorId}, 'student.bulk_reconcile', 'student', null,
                ${sql.json({ count: fixed.length, sample: fixed.slice(0, 50) })})
      `;
    }
  });
  return { updated };
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
 * Политика переходов статусов. Возвращает true, если такой переход допустим.
 * Терминальные (graduated/closed/archived) → active разрешён, но требует обязательной reason.
 * graduated → не active напрямую (выпускник, нечего «возвращать обратно в active», но мы разрешим).
 */
export function canTransitionStudentStatus(
  from: StudentStatus | null,
  to: StudentStatus,
  reason: string | null,
): { ok: true } | { ok: false; error: string } {
  if (from === null) return { ok: true };
  if (from === to) return { ok: false, error: "Это уже текущий статус" };

  // Из терминальных состояний возврат в active требует объяснения.
  const terminal: StudentStatus[] = ["graduated", "dropped", "closed", "archived"];
  if (terminal.includes(from) && to === "active" && (!reason || reason.trim().length < 3)) {
    return {
      ok: false,
      error: "Возврат из терминального статуса в «Обучается» требует комментария (≥ 3 символа)",
    };
  }

  return { ok: true };
}

/**
 * Сменить статус ученика. При переходе в «неактивный» (не active/paused) проставляем archived_at.
 * Возврат в active из любого статуса сбрасывает archived_at и пишется в audit как реактивация.
 */
export async function changeStudentStatus(input: {
  student_id: string;
  new_status: StudentStatus;
  reason: string | null;
  actor_id: string;
}): Promise<void> {
  await sql.begin(async (tx) => {
    const prev = await tx<Array<{ status: string }>>`
      select status from students where id = ${input.student_id} for update
    `;
    const oldStatus = prev[0]?.status ?? null;

    const policy = canTransitionStudentStatus(
      oldStatus as StudentStatus | null,
      input.new_status,
      input.reason,
    );
    if (!policy.ok) throw new Error(policy.error);

    const isArchiving = !["active", "paused"].includes(input.new_status);
    const isReactivating =
      input.new_status === "active" &&
      oldStatus !== null &&
      ["graduated", "dropped", "closed", "archived"].includes(oldStatus);

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
                reactivated: isReactivating,
              })})
    `;
  });
}

/** Обновление профиля ученика (ФИО, телефон, ТГ, WhatsApp, charity). */
export async function updateStudentProfile(input: {
  student_id: string;
  full_name: string;
  phone: string | null;
  telegram_username: string | null;
  telegram_phone: string | null;
  whatsapp_phone: string | null;
  is_charity: boolean;
  charity_note: string | null;
  actor_id: string;
}): Promise<void> {
  await sql.begin(async (tx) => {
    const prev = await tx<Array<{
      full_name: string;
      phone: string | null;
      telegram_username: string | null;
      telegram_phone: string | null;
      whatsapp_phone: string | null;
      is_charity: boolean;
    }>>`
      select full_name, phone, telegram_username, telegram_phone, whatsapp_phone, is_charity
      from students where id = ${input.student_id} for update
    `;
    const old = prev[0];

    await tx`
      update students
      set full_name = ${input.full_name},
          phone = ${input.phone},
          telegram_username = ${input.telegram_username},
          telegram_phone = ${input.telegram_phone},
          whatsapp_phone = ${input.whatsapp_phone},
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
                  telegram_phone: input.telegram_phone,
                  whatsapp_phone: input.whatsapp_phone,
                  is_charity: input.is_charity,
                },
              })})
    `;
  });
}

/** Последняя смена учителя — для отображения «заметка от прошлого учителя» новому. */
export interface LastTeacherChangeNote {
  changed_at: Date;
  old_teacher_name: string | null;
  new_teacher_name: string | null;
  reason: string | null;
  actor_name: string | null;
}

export async function getLastTeacherChangeNote(
  studentId: string,
): Promise<LastTeacherChangeNote | null> {
  const rows = await sql<
    Array<{
      created_at: Date;
      old_teacher_name: string | null;
      new_teacher_name: string | null;
      reason: string | null;
      actor_name: string | null;
    }>
  >`
    select
      a.created_at,
      ot.full_name as old_teacher_name,
      nt.full_name as new_teacher_name,
      a.diff->>'reason' as reason,
      u.full_name as actor_name
    from audit_log a
    left join teachers ot on ot.id::text = a.diff->>'old_teacher_id'
    left join teachers nt on nt.id::text = a.diff->>'new_teacher_id'
    left join users u on u.id = a.actor_id
    where a.action = 'student.change_teacher'
      and a.entity_type = 'student'
      and a.entity_id = ${studentId}
      and a.diff->>'reason' is not null
      and length(coalesce(a.diff->>'reason', '')) > 0
    order by a.created_at desc
    limit 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0]!;
  return {
    changed_at: r.created_at,
    old_teacher_name: r.old_teacher_name,
    new_teacher_name: r.new_teacher_name,
    reason: r.reason,
    actor_name: r.actor_name,
  };
}

/** История всех смен учителей — для куратора (П7). */
export interface TeacherChangeEntry {
  changed_at: Date;
  old_teacher_name: string | null;
  new_teacher_name: string | null;
  reason: string | null;
  actor_name: string | null;
}

export async function getStudentTeacherHistory(
  studentId: string,
): Promise<TeacherChangeEntry[]> {
  return sql<TeacherChangeEntry[]>`
    select
      a.created_at as changed_at,
      ot.full_name as old_teacher_name,
      nt.full_name as new_teacher_name,
      a.diff->>'reason' as reason,
      u.full_name as actor_name
    from audit_log a
    left join teachers ot on ot.id::text = a.diff->>'old_teacher_id'
    left join teachers nt on nt.id::text = a.diff->>'new_teacher_id'
    left join users u on u.id = a.actor_id
    where a.action = 'student.change_teacher'
      and a.entity_type = 'student'
      and a.entity_id = ${studentId}
    order by a.created_at desc
  `;
}

/**
 * Снять учителя с ученика (teacher_id := NULL).
 * Используется когда учитель сам открепляет случайно назначенного ученика.
 */
export async function unassignStudentTeacher(input: {
  student_id: string;
  actor_id: string;
  reason: string | null;
}): Promise<void> {
  await sql.begin(async (tx) => {
    const prev = await tx<Array<{ teacher_id: string | null }>>`
      select teacher_id from students where id = ${input.student_id} for update
    `;
    const oldTeacherId = prev[0]?.teacher_id ?? null;
    await tx`
      update students set teacher_id = null, updated_at = now()
      where id = ${input.student_id}
    `;
    await tx`
      insert into audit_log (actor_id, action, entity_type, entity_id, diff)
      values (${input.actor_id}, 'student.unassign_teacher', 'student', ${input.student_id},
              ${sql.json({ old_teacher_id: oldTeacherId, reason: input.reason })})
    `;
  });
}

export async function changeStudentTeacher(input: {
  student_id: string;
  new_teacher_id: string;
  reason: string | null;
  actor_id: string;
}): Promise<void> {
  let didChange = false;
  await sql.begin(async (tx) => {
    const prev = await tx<Array<{ teacher_id: string | null }>>`
      select teacher_id from students where id = ${input.student_id} for update
    `;
    const oldTeacherId = prev[0]?.teacher_id ?? null;
    didChange = oldTeacherId !== input.new_teacher_id;

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
  if (didChange) {
    const { notifyTeacherAssigned } = await import("@/lib/notify");
    await notifyTeacherAssigned(input.student_id, input.new_teacher_id, input.actor_id);
  }
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
 * Текущие ученики учителя (s.teacher_id = teacherId).
 * Для форм записи урока, главной с балансами и т.п.
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
        count(*) filter (where status in ('conducted', 'penalty'))::int as total
      from lessons
      where student_id = s.id and deleted_at is null
    ) agg on true
    where s.teacher_id = ${teacherId}
      and s.status in ('active', 'paused', 'graduated', 'dropped', 'archived')
      and s.deleted_at is null
    order by s.full_name
  `;
  return rows;
}

export interface StudentListItemExtended extends StudentListItem {
  is_current: boolean;             // true = ученик сейчас у этого учителя
  current_teacher_name: string | null; // имя нового учителя, если передан
}

/**
 * Список с бывшими учениками: те, кого передали другому учителю,
 * но с которыми у этого учителя были уроки. Агрегаты для бывших считаются
 * ТОЛЬКО по урокам с этим учителем — это «своя история».
 */
export async function teacherStudentListWithFormer(
  teacherId: string,
): Promise<StudentListItemExtended[]> {
  const rows = await sql<StudentListItemExtended[]>`
    with my_lessons as (
      select student_id, lesson_date, status, created_at
      from lessons
      where teacher_id = ${teacherId} and deleted_at is null
    ),
    relevant as (
      select s.id from students s where s.teacher_id = ${teacherId}
        and s.status in ('active', 'paused', 'graduated', 'dropped', 'archived')
        and s.deleted_at is null
      union
      select distinct ml.student_id as id from my_lessons ml
    )
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
      end as attendance_pct,
      (s.teacher_id = ${teacherId}) as is_current,
      case when s.teacher_id != ${teacherId} then ct.full_name else null end as current_teacher_name
    from students s
    join relevant r on r.id = s.id
    left join teachers ct on ct.id = s.teacher_id
    left join lateral (
      select lesson_date, status
      from my_lessons
      where student_id = s.id
      order by lesson_date desc, created_at desc
      limit 1
    ) last_lesson on true
    left join lateral (
      select
        min(lesson_date) as first_lesson_date,
        count(*) filter (where status = 'conducted')::int as conducted,
        count(*) filter (where status in ('conducted', 'penalty'))::int as total
      from my_lessons
      where student_id = s.id
    ) agg on true
    where s.deleted_at is null
    order by (s.teacher_id = ${teacherId}) desc, s.full_name
  `;
  return rows;
}

/**
 * Привязать ученика к менеджеру (или сменить менеджера).
 * Любая роль manager/curator/head/admin может «забрать ученика себе»,
 * чтобы он попадал в её «Мои».
 */
export async function claimStudent(
  studentId: string,
  actorId: string,
): Promise<{ old_user_id: string | null }> {
  return sql.begin(async (tx) => {
    const prev = await tx<Array<{ created_by_user_id: string | null }>>`
      select created_by_user_id from students where id = ${studentId} for update
    `;
    if (prev.length === 0) throw new Error("not_found");
    const oldUserId = prev[0]!.created_by_user_id;
    if (oldUserId === actorId) return { old_user_id: oldUserId };

    await tx`
      update students
      set created_by_user_id = ${actorId}, updated_at = now()
      where id = ${studentId}
    `;
    await tx`
      insert into audit_log (actor_id, action, entity_type, entity_id, diff)
      values (${actorId}, 'student.claim', 'student', ${studentId},
              ${sql.json({ old_user_id: oldUserId, new_user_id: actorId })})
    `;
    return { old_user_id: oldUserId };
  });
}

/**
 * Мягкое удаление ученика. Только head/admin.
 * Запись остаётся в БД (история уроков, балансов сохраняется),
 * но не отображается ни в каких списках.
 */
export async function deleteStudent(
  studentId: string,
  actorId: string,
): Promise<void> {
  await sql.begin(async (tx) => {
    const result = await tx<Array<{ id: string }>>`
      update students
      set deleted_at = now(), updated_at = now()
      where id = ${studentId} and deleted_at is null
      returning id
    `;
    if (result.length === 0) throw new Error("not_found");
    await tx`
      insert into audit_log (actor_id, action, entity_type, entity_id, diff)
      values (${actorId}, 'student.delete', 'student', ${studentId}, ${sql.json({})})
    `;
  });
}
