"use server";

import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { findTeacherByUserId } from "@/lib/repos/teachers";
import { createLesson } from "@/lib/repos/lessons";
import { sql } from "@/lib/db";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hhmm = z.string().regex(/^\d{2}:\d{2}$/);

const schema = z.object({
  student_id: z.string().uuid(),
  lesson_date: isoDate,                         // фактическая дата
  lesson_time: hhmm.nullable().optional(),
  scheduled_date: isoDate.nullable().optional(), // если null → равна lesson_date (по графику)
  scheduled_time: hhmm.nullable().optional(),
  status: z.enum(["conducted", "penalty", "cancelled_by_teacher", "cancelled_by_student"]),
  topic: z.string().max(200).nullable().optional(),
});

export type CreateLessonInput = z.infer<typeof schema>;

export async function createLessonAction(
  input: CreateLessonInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Некорректные данные" };
  }

  const { user } = await requireRole("teacher");
  const teacher = await findTeacherByUserId(user.id);
  if (!teacher) return { ok: false, error: "Профиль учителя не настроен" };

  // Ученик обязан быть в группе этого учителя
  const belongs = await sql<Array<{ id: string }>>`
    select id from students where id = ${parsed.data.student_id} and teacher_id = ${teacher.id}
  `;
  if (belongs.length === 0) {
    return { ok: false, error: "Этот ученик не в вашей группе" };
  }

  try {
    const id = await createLesson({
      student_id: parsed.data.student_id,
      teacher_id: teacher.id,
      lesson_date: parsed.data.lesson_date,
      lesson_time: parsed.data.lesson_time ?? null,
      scheduled_date: parsed.data.scheduled_date ?? parsed.data.lesson_date,
      scheduled_time: parsed.data.scheduled_time ?? parsed.data.lesson_time ?? null,
      status: parsed.data.status,
      topic: parsed.data.topic ?? null,
      created_by: user.id,
    });
    return { ok: true, id };
  } catch (err) {
    console.error("createLesson failed:", err);
    return { ok: false, error: "Не удалось сохранить урок" };
  }
}

/**
 * Быстрая запись урока с экрана «Сегодня»: по клику на кнопку.
 * Отличается от createLessonAction только тем, что не требует тему и использует дефолты.
 */
export async function quickLogLessonAction(input: CreateLessonInput) {
  return createLessonAction(input);
}
