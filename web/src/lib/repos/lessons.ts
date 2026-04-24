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
    select l.id, l.lesson_date, l.lesson_time, l.status,
           s.id as student_id, s.full_name as student_name,
           t.id as teacher_id, t.full_name as teacher_name
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
