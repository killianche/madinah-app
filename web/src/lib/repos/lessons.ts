import { sql } from "@/lib/db";
import type { LessonStatus } from "@/lib/types";
import { notifyLowBalanceIfNeeded } from "@/lib/notify";

// conducted и penalty списывают урок с баланса.
// cancelled_by_student и cancelled_by_teacher — баланс не трогаем.
export const LESSON_DEDUCT_STATUSES: LessonStatus[] = [
  "conducted",
  "penalty",
];

export interface CreateLessonInput {
  student_id: string;
  teacher_id: string;
  lesson_date: string;           // ISO YYYY-MM-DD
  lesson_time?: string | null;   // "HH:MM"
  status: LessonStatus;
  topic?: string | null;
  notes?: string | null;
  created_by: string;
}

/**
 * Создаёт урок и (если нужно) списывает с баланса — одной транзакцией.
 */
export async function createLesson(input: CreateLessonInput): Promise<string> {
  const lessonId = await sql.begin(async (tx) => {
    const rows = await tx<Array<{ id: string }>>`
      insert into lessons
        (student_id, teacher_id, lesson_date, lesson_time,
         status, topic, notes, created_by)
      values
        (${input.student_id}, ${input.teacher_id}, ${input.lesson_date},
         ${input.lesson_time ?? null}, ${input.status},
         ${input.topic ?? null}, ${input.notes ?? null}, ${input.created_by})
      returning id
    `;
    const id = rows[0]!.id;

    if (LESSON_DEDUCT_STATUSES.includes(input.status)) {
      await tx`
        update students set balance = balance - 1, updated_at = now()
        where id = ${input.student_id}
      `;
    }

    await tx`
      insert into audit_log (actor_id, action, entity_type, entity_id, diff)
      values (${input.created_by}, 'lesson.create', 'lesson', ${id}, ${sql.json({
        status: input.status,
        lesson_date: input.lesson_date,
        student: input.student_id,
      })})
    `;

    return id;
  });

  // После транзакции: если списался баланс — проверим low_balance.
  if (LESSON_DEDUCT_STATUSES.includes(input.status)) {
    await notifyLowBalanceIfNeeded(input.student_id);
  }
  return lessonId;
}

export interface LessonListItem {
  id: string;
  lesson_date: Date;
  lesson_time: string | null;
  status: LessonStatus;
  student_id: string;
  student_name: string;
  teacher_id: string;
  teacher_name: string;
  /** Порядковый номер ЗАСЧИТАННОГО урока (conducted + penalty). 0 для отменённых. */
  ordinal: number;
  topic: string | null;
}

export async function listLessonsForStudent(studentId: string, limit = 50): Promise<LessonListItem[]> {
  // Номер #N — это «какой по счёту засчитанный урок» (conducted + penalty).
  // Отменённые (cancelled_by_student/teacher) баланс не списывают и не считаются — у них ordinal = 0.
  const rows = await sql<LessonListItem[]>`
    with numbered as (
      select l.*,
        case
          when l.status in ('conducted', 'penalty') then
            row_number() over (
              partition by case when l.status in ('conducted', 'penalty') then 1 else 0 end
              order by l.lesson_date asc, l.created_at asc
            )
          else 0
        end as ordinal
      from lessons l
      where l.student_id = ${studentId} and l.deleted_at is null
    )
    select n.id, n.lesson_date, n.lesson_time, n.status, n.topic,
           s.id as student_id, s.full_name as student_name,
           t.id as teacher_id, t.full_name as teacher_name,
           n.ordinal::int
    from numbered n
    join students s on s.id = n.student_id
    join teachers t on t.id = n.teacher_id
    order by n.lesson_date desc, n.created_at desc
    limit ${limit}
  `;
  return rows;
}

export interface TeacherMonthStat {
  month: Date;
  students: number;            // уникальных учеников в этом месяце
  new_students: number;        // первый урок с этим учителем в этом месяце
  conducted: number;
  penalty: number;
  cancelled_by_teacher: number;
  cancelled_by_student: number;
  /** Засчитанные = conducted + penalty. Отмены не входят. */
  total: number;
}

/**
 * Аналитика учителя по месяцам — последние N месяцев с активностью.
 * new_students: ученики, у которых первый урок С ЭТИМ УЧИТЕЛЕМ — в этом месяце.
 */
export async function getTeacherMonthlyStats(
  teacherId: string,
  limit = 6,
): Promise<TeacherMonthStat[]> {
  return sql<TeacherMonthStat[]>`
    with first_lesson as (
      select student_id, min(lesson_date) as first_date
      from lessons
      where teacher_id = ${teacherId} and deleted_at is null
      group by student_id
    )
    select
      date_trunc('month', l.lesson_date)::date as month,
      count(distinct l.student_id)::int as students,
      count(distinct l.student_id) filter (
        where date_trunc('month', fl.first_date) = date_trunc('month', l.lesson_date)
      )::int as new_students,
      count(*) filter (where l.status = 'conducted')::int as conducted,
      count(*) filter (where l.status = 'penalty')::int as penalty,
      count(*) filter (where l.status = 'cancelled_by_teacher')::int as cancelled_by_teacher,
      count(*) filter (where l.status = 'cancelled_by_student')::int as cancelled_by_student,
      count(*) filter (where l.status in ('conducted', 'penalty'))::int as total
    from lessons l
    join first_lesson fl on fl.student_id = l.student_id
    where l.teacher_id = ${teacherId} and l.deleted_at is null
    group by 1
    order by 1 desc
    limit ${limit}
  `;
}

export async function listLessonsForTeacher(teacherId: string, limit = 100): Promise<LessonListItem[]> {
  const rows = await sql<LessonListItem[]>`
    select l.id, l.lesson_date, l.lesson_time, l.status, l.topic,
           s.id as student_id, s.full_name as student_name,
           t.id as teacher_id, t.full_name as teacher_name,
           0::int as ordinal
    from lessons l
    join students s on s.id = l.student_id
    join teachers t on t.id = l.teacher_id
    where l.teacher_id = ${teacherId}
      and l.deleted_at is null
    order by l.lesson_date desc, l.created_at desc
    limit ${limit}
  `;
  return rows;
}

export interface TeacherTotalStats {
  first_lesson_date: Date | null;
  /** Только засчитанные (conducted + penalty) — отмены не входят. */
  total_lessons: number;
  conducted: number;
  penalty: number;
  cancelled: number;
  unique_students: number;
}

/** Суммарная статистика учителя за всё время. */
export async function getTeacherTotalStats(
  teacherId: string,
): Promise<TeacherTotalStats> {
  const rows = await sql<TeacherTotalStats[]>`
    select
      min(lesson_date) as first_lesson_date,
      count(*) filter (where status in ('conducted', 'penalty'))::int as total_lessons,
      count(*) filter (where status = 'conducted')::int as conducted,
      count(*) filter (where status = 'penalty')::int as penalty,
      count(*) filter (where status in ('cancelled_by_student','cancelled_by_teacher'))::int as cancelled,
      count(distinct student_id)::int as unique_students
    from lessons
    where teacher_id = ${teacherId} and deleted_at is null
  `;
  return rows[0] ?? {
    first_lesson_date: null,
    total_lessons: 0,
    conducted: 0,
    penalty: 0,
    cancelled: 0,
    unique_students: 0,
  };
}

export interface TeacherTopStudent {
  student_id: string;
  student_name: string;
  conducted: number;
  penalty: number;
  balance: number;
  months_with_teacher: number;
}

export interface DayResult {
  date: string; // YYYY-MM-DD
  conducted: number;
  penalty: number;
  cancelled: number;
}

/** Результаты за сегодня и вчера. Возвращает массив до 2 элементов. */
export async function getTeacherTodayYesterday(
  teacherId: string,
): Promise<DayResult[]> {
  return sql<DayResult[]>`
    select
      to_char(lesson_date, 'YYYY-MM-DD') as date,
      count(*) filter (where status = 'conducted')::int as conducted,
      count(*) filter (where status = 'penalty')::int as penalty,
      count(*) filter (where status in ('cancelled_by_student', 'cancelled_by_teacher'))::int as cancelled
    from lessons
    where teacher_id = ${teacherId}
      and deleted_at is null
      and lesson_date in (current_date, current_date - 1)
    group by lesson_date
    order by lesson_date desc
  `;
}

/** Уроки по дням за месяц — для спарклайна. */
export async function getTeacherDailyLessons(
  teacherId: string,
  year: number,
  month: number, // 1..12
): Promise<Array<{ day: number; conducted: number; total: number }>> {
  return sql<Array<{ day: number; conducted: number; total: number }>>`
    select
      extract(day from lesson_date)::int as day,
      count(*) filter (where status = 'conducted')::int as conducted,
      count(*)::int as total
    from lessons
    where teacher_id = ${teacherId}
      and deleted_at is null
      and extract(year from lesson_date) = ${year}
      and extract(month from lesson_date) = ${month}
    group by day
    order by day
  `;
}

/**
 * Средняя нагрузка за рабочие дни за последние N дней.
 * Считает conducted+penalty (засчитанные уроки), делит на ЧИСЛО ДНЕЙ С УРОКАМИ,
 * а не на N — потому что в нерабочие дни учитель не должен «штрафоваться».
 */
export async function getTeacherDailyAverage(
  teacherId: string,
  days = 30,
): Promise<number> {
  const rows = await sql<Array<{ avg_per_day: number }>>`
    with working as (
      select lesson_date, count(*) filter (where status in ('conducted','penalty')) as n
      from lessons
      where teacher_id = ${teacherId}
        and deleted_at is null
        and lesson_date >= current_date - ${days}::int
      group by lesson_date
      having count(*) filter (where status in ('conducted','penalty')) > 0
    )
    select round(
      coalesce(avg(n), 0)::numeric,
      1
    )::float as avg_per_day
    from working
  `;
  return rows[0]?.avg_per_day ?? 0;
}

/** Лучший стрик за всё время — самая длинная серия дней подряд с conducted. */
export async function getTeacherBestStreak(teacherId: string): Promise<number> {
  const rows = await sql<Array<{ best: number }>>`
    with days as (
      select distinct lesson_date::date as d
      from lessons
      where teacher_id = ${teacherId}
        and deleted_at is null
        and status = 'conducted'
    ),
    grouped as (
      select d, d - (row_number() over (order by d))::int * interval '1 day' as grp
      from days
    ),
    streaks as (
      select count(*)::int as len from grouped group by grp
    )
    select coalesce(max(len), 0)::int as best from streaks
  `;
  return rows[0]?.best ?? 0;
}

/** Уроки по неделям за последние 12 недель — для тренда на карточке учителя. */
export async function getTeacherWeeklyChart12W(
  teacherId: string,
): Promise<Array<{ week_start: string; conducted: number; penalty: number; cancelled: number }>> {
  return sql<Array<{ week_start: string; conducted: number; penalty: number; cancelled: number }>>`
    with weeks as (
      select generate_series(
        date_trunc('week', current_date - 11 * interval '7 days')::date,
        date_trunc('week', current_date)::date,
        interval '7 days'
      )::date as week_start
    )
    select
      to_char(w.week_start, 'YYYY-MM-DD') as week_start,
      coalesce(count(l.*) filter (where l.status = 'conducted'), 0)::int as conducted,
      coalesce(count(l.*) filter (where l.status = 'penalty'), 0)::int as penalty,
      coalesce(count(l.*) filter (where l.status in ('cancelled_by_student','cancelled_by_teacher')), 0)::int as cancelled
    from weeks w
    left join lessons l on l.teacher_id = ${teacherId}
      and l.deleted_at is null
      and l.lesson_date >= w.week_start
      and l.lesson_date < w.week_start + interval '7 days'
    group by w.week_start
    order by w.week_start
  `;
}

/** Уроки по дням за последнюю неделю — для bar-chart на главной. */
export async function getTeacherWeekChart(
  teacherId: string,
): Promise<Array<{ date: string; count: number; weekday: number }>> {
  return sql<Array<{ date: string; count: number; weekday: number }>>`
    with days as (
      select generate_series(
        current_date - 6, current_date, interval '1 day'
      )::date as d
    )
    select
      to_char(days.d, 'YYYY-MM-DD') as date,
      coalesce(count(l.*) filter (where l.status in ('conducted', 'penalty')), 0)::int as count,
      extract(isodow from days.d)::int as weekday
    from days
    left join lessons l on l.lesson_date = days.d
      and l.teacher_id = ${teacherId}
      and l.deleted_at is null
    group by days.d
    order by days.d
  `;
}

/** Текущий стрик — непрерывные дни с conducted-уроками до сегодня. */
export async function getTeacherStreak(teacherId: string): Promise<number> {
  const rows = await sql<Array<{ streak: number }>>`
    with days as (
      select distinct lesson_date::date as d
      from lessons
      where teacher_id = ${teacherId}
        and deleted_at is null
        and status = 'conducted'
      order by d desc
    ),
    numbered as (
      select d, row_number() over (order by d desc)::int as rn
      from days
    ),
    streak_rows as (
      select d, rn
      from numbered
      where (current_date - d)::int = rn - 1
    )
    select coalesce(count(*), 0)::int as streak from streak_rows
  `;
  return rows[0]?.streak ?? 0;
}

/** Процентиль учителя по числу conducted-уроков за последние 30 дней. */
export async function getTeacherSchoolRank(
  teacherId: string,
): Promise<{ percentile: number; totalTeachers: number } | null> {
  const rows = await sql<Array<{ percentile: number; total_teachers: number }>>`
    with totals as (
      select teacher_id, count(*)::int as n
      from lessons
      where deleted_at is null
        and status = 'conducted'
        and lesson_date >= current_date - 30
      group by teacher_id
    ),
    me as (select n from totals where teacher_id = ${teacherId}),
    ranked as (
      select
        (select n from me)                                     as my_n,
        count(*)                                                as total_teachers,
        count(*) filter (where n < (select n from me))::int    as below
      from totals
    )
    select
      case when total_teachers = 0 then 0
           else round((below::numeric / total_teachers) * 100)::int
      end as percentile,
      total_teachers::int as total_teachers
    from ranked
  `;
  const r = rows[0];
  if (!r) return null;
  return { percentile: r.percentile, totalTeachers: r.total_teachers };
}

/** Топ учеников учителя по числу проведённых уроков. */
export async function getTeacherTopStudents(
  teacherId: string,
  limit = 10,
): Promise<TeacherTopStudent[]> {
  return sql<TeacherTopStudent[]>`
    select s.id as student_id,
           s.full_name as student_name,
           count(*) filter (where l.status = 'conducted')::int as conducted,
           count(*) filter (where l.status = 'penalty')::int as penalty,
           s.balance::int,
           greatest(
             1,
             ((extract(year from age(current_date, min(l.lesson_date)))::int) * 12
              + extract(month from age(current_date, min(l.lesson_date)))::int)
           )::int as months_with_teacher
    from lessons l
    join students s on s.id = l.student_id
    where l.teacher_id = ${teacherId} and l.deleted_at is null
    group by s.id, s.full_name, s.balance
    order by count(*) filter (where l.status in ('conducted','penalty')) desc
    limit ${limit}
  `;
}
