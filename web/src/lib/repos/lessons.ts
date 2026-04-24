import { sql } from "@/lib/db";
import type { LessonStatus } from "@/lib/types";

// conducted и cancelled_by_student списывают урок с баланса
// (ученик либо провёл, либо сам отменил → его ответственность → урок «сгорает»).
// cancelled_by_teacher и penalty не списывают.
export const LESSON_DEDUCT_STATUSES: LessonStatus[] = [
  "conducted",
  "cancelled_by_student",
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
  return sql.begin(async (tx) => {
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
    const lessonId = rows[0]!.id;

    if (LESSON_DEDUCT_STATUSES.includes(input.status)) {
      await tx`
        update students set balance = balance - 1, updated_at = now()
        where id = ${input.student_id}
      `;
    }

    await tx`
      insert into audit_log (actor_id, action, entity_type, entity_id, diff)
      values (${input.created_by}, 'lesson.create', 'lesson', ${lessonId}, ${sql.json({
        status: input.status,
        lesson_date: input.lesson_date,
        student: input.student_id,
      })})
    `;

    return lessonId;
  });
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
  ordinal: number;  // порядковый номер урока у этого ученика (1 = самый первый)
  topic: string | null;
}

export async function listLessonsForStudent(studentId: string, limit = 50): Promise<LessonListItem[]> {
  const rows = await sql<LessonListItem[]>`
    with numbered as (
      select l.*,
        row_number() over (order by lesson_date asc, created_at asc) as ordinal
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
      count(*)::int as total
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
      count(*)::int as total_lessons,
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
  total: number;
  balance: number;
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

/** Средняя нагрузка за последние N недель (conducted только). */
export async function getTeacherWeeklyAverage(
  teacherId: string,
  weeks = 8,
): Promise<number> {
  const rows = await sql<Array<{ avg_per_week: number }>>`
    select round(
      count(*) filter (where status = 'conducted')::numeric
      / ${weeks}::numeric,
      1
    )::float as avg_per_week
    from lessons
    where teacher_id = ${teacherId}
      and deleted_at is null
      and lesson_date >= current_date - ${weeks * 7}::int
  `;
  return rows[0]?.avg_per_week ?? 0;
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
           count(*)::int as total,
           s.balance::int
    from lessons l
    join students s on s.id = l.student_id
    where l.teacher_id = ${teacherId} and l.deleted_at is null
    group by s.id, s.full_name, s.balance
    order by conducted desc, total desc
    limit ${limit}
  `;
}
