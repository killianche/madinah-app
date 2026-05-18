import { sql } from "@/lib/db";
import type { LessonStatus, StudentSchedule } from "@/lib/types";

/**
 * Регулярные слоты ученика. weekday: 1..7 (ISO, пн=1).
 */
export async function listSchedulesForStudent(studentId: string): Promise<StudentSchedule[]> {
  return sql<StudentSchedule[]>`
    select id, student_id, weekday, to_char(time_at, 'HH24:MI') as time_at,
           duration_min, active, note
    from student_schedules
    where student_id = ${studentId}
    order by weekday, time_at
  `;
}

export interface CreateScheduleInput {
  student_id: string;
  weekday: number;      // 1..7
  time_at: string;      // "18:00"
  duration_min?: number;
  note?: string | null;
}

export async function createSchedule(input: CreateScheduleInput): Promise<string> {
  const rows = await sql<Array<{ id: string }>>`
    insert into student_schedules (student_id, weekday, time_at, duration_min, note)
    values (${input.student_id}, ${input.weekday}, ${input.time_at},
            ${input.duration_min ?? 60}, ${input.note ?? null})
    on conflict (student_id, weekday, time_at)
    do update set active = true, duration_min = excluded.duration_min, note = excluded.note
    returning id
  `;
  return rows[0]!.id;
}

export async function deactivateSchedule(scheduleId: string): Promise<void> {
  await sql`update student_schedules set active = false where id = ${scheduleId}`;
}

/**
 * Агрегированное расписание учителя по дням недели — для декоративного WeekStrip.
 * Возвращает уникальные (weekday, time_at) у активных учеников этого учителя.
 */
export async function getTeacherWeekSchedule(
  teacherId: string,
): Promise<Array<{ weekday: number; time_at: string }>> {
  const rows = await sql<Array<{ weekday: number; time_at: string }>>`
    select distinct sc.weekday, to_char(sc.time_at, 'HH24:MI') as time_at
    from student_schedules sc
    join students s on s.id = sc.student_id
    where sc.active = true
      and s.teacher_id = ${teacherId}
      and s.status in ('active', 'paused')
    order by sc.weekday, to_char(sc.time_at, 'HH24:MI')
  `;
  return rows;
}

// ============================================================
// AGENDA — дневная повестка учителя
// Строится из SQL-функции teacher_day_agenda(teacher_id, date):
//   объединение слотов по расписанию (на день недели) и уроков,
//   уже записанных на эту дату (включая проведённые не по графику).
// ============================================================

export interface AgendaItem {
  kind: "scheduled" | "lesson";
  slot_time: string | null;          // "18:00"
  student_id: string;
  student_name: string;
  student_balance: number;
  lesson_id: string | null;
  lesson_status: LessonStatus | null;
}

export async function getTeacherDayAgenda(
  teacherId: string,
  date: string, // YYYY-MM-DD
): Promise<AgendaItem[]> {
  type Row = {
    kind: "scheduled" | "lesson";
    slot_time: string | null;
    student_id: string;
    student_name: string;
    student_balance: number;
    lesson_id: string | null;
    lesson_status: LessonStatus | null;
  };
  const rows = await sql<Row[]>`
    select kind,
           to_char(slot_time, 'HH24:MI') as slot_time,
           student_id, student_name, student_balance,
           lesson_id, lesson_status
    from teacher_day_agenda(${teacherId}, ${date})
    order by slot_time nulls last, student_name
  `;
  return rows;
}
