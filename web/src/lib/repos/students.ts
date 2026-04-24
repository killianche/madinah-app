import { sql } from "@/lib/db";
import type { Student, LessonStatus } from "@/lib/types";

export interface StudentWithTeacher extends Student {
  teacher_name: string | null;
}

export async function listStudentsByTeacher(teacherId: string): Promise<StudentWithTeacher[]> {
  const rows = await sql<StudentWithTeacher[]>`
    select s.*, t.full_name as teacher_name
    from students s
    left join teachers t on t.id = s.teacher_id
    where s.teacher_id = ${teacherId}
      and s.status = 'active'
    order by s.full_name
  `;
  return rows;
}

export async function listAllActiveStudents(): Promise<StudentWithTeacher[]> {
  const rows = await sql<StudentWithTeacher[]>`
    select s.*, t.full_name as teacher_name
    from students s
    left join teachers t on t.id = s.teacher_id
    where s.status = 'active'
    order by s.full_name
    limit 500
  `;
  return rows;
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

export interface StudentListItem {
  id: string;
  full_name: string;
  balance: number;
  is_charity: boolean;
  last_lesson_date: Date | null;
  last_lesson_status: LessonStatus | null;
}

/**
 * Компактная выборка для главного экрана учителя — сразу с баланс и last lesson.
 */
export async function teacherStudentList(teacherId: string): Promise<StudentListItem[]> {
  const rows = await sql<StudentListItem[]>`
    select
      s.id,
      s.full_name,
      s.balance,
      s.is_charity,
      last_lesson.lesson_date as last_lesson_date,
      last_lesson.status as last_lesson_status
    from students s
    left join lateral (
      select lesson_date, status
      from lessons
      where student_id = s.id and deleted_at is null
      order by lesson_date desc, created_at desc
      limit 1
    ) last_lesson on true
    where s.teacher_id = ${teacherId}
      and s.status = 'active'
    order by s.full_name
  `;
  return rows;
}
