import { sql } from "@/lib/db";
import type { LessonStatus } from "@/lib/types";

export const LESSON_DEDUCT_STATUSES: LessonStatus[] = ["conducted", "penalty"];

export interface CreateLessonInput {
  student_id: string;
  teacher_id: string;
  lesson_date: string;           // фактическая дата (ISO YYYY-MM-DD)
  lesson_time?: string | null;   // фактическое время "HH:MM"
  scheduled_date?: string | null; // если отличается от lesson_date → перенос
  scheduled_time?: string | null;
  status: LessonStatus;
  topic?: string | null;
  notes?: string | null;
  created_by: string;            // users.id
}

/**
 * Создаёт урок и (если нужно) списывает с баланса — одной транзакцией.
 * Если scheduled_date не передан — считаем, что урок по графику (scheduled = lesson).
 */
export async function createLesson(input: CreateLessonInput): Promise<string> {
  const scheduledDate = input.scheduled_date ?? input.lesson_date;
  const scheduledTime = input.scheduled_time ?? input.lesson_time ?? null;
  const offSchedule = scheduledDate !== input.lesson_date;

  return sql.begin(async (tx) => {
    const rows = await tx<Array<{ id: string }>>`
      insert into lessons
        (student_id, teacher_id, lesson_date, lesson_time,
         scheduled_date, scheduled_time, status, topic, notes, created_by)
      values
        (${input.student_id}, ${input.teacher_id}, ${input.lesson_date},
         ${input.lesson_time ?? null},
         ${scheduledDate}, ${scheduledTime}, ${input.status},
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
        scheduled_date: scheduledDate,
        off_schedule: offSchedule,
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
  scheduled_date: Date;
  status: LessonStatus;
  student_id: string;
  student_name: string;
  teacher_id: string;
  teacher_name: string;
  off_schedule: boolean;
}

export async function listLessonsForStudent(studentId: string, limit = 50): Promise<LessonListItem[]> {
  const rows = await sql<LessonListItem[]>`
    select l.id, l.lesson_date, l.lesson_time, l.scheduled_date, l.status,
           (l.scheduled_date <> l.lesson_date) as off_schedule,
           s.id as student_id, s.full_name as student_name,
           t.id as teacher_id, t.full_name as teacher_name
    from lessons l
    join students s on s.id = l.student_id
    join teachers t on t.id = l.teacher_id
    where l.student_id = ${studentId}
      and l.deleted_at is null
    order by l.lesson_date desc, l.created_at desc
    limit ${limit}
  `;
  return rows;
}

export async function listLessonsForTeacher(teacherId: string, limit = 100): Promise<LessonListItem[]> {
  const rows = await sql<LessonListItem[]>`
    select l.id, l.lesson_date, l.lesson_time, l.scheduled_date, l.status,
           (l.scheduled_date <> l.lesson_date) as off_schedule,
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
