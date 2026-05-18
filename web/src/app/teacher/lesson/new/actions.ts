"use server";

import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { findTeacherByUserId } from "@/lib/repos/teachers";
import { createLesson } from "@/lib/repos/lessons";
import { assertTeacherOwnsStudent } from "@/lib/repos/students";
import { sql } from "@/lib/db";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    // Запрещаем будущие даты (учитель отмечает уже состоявшийся урок).
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return new Date(s + "T00:00:00") <= today;
  }, "Дата урока в будущем");

const hhmm = z.string().regex(/^\d{2}:\d{2}$/);

const schema = z.object({
  student_id: z.string().uuid(),
  lesson_date: isoDate,
  lesson_time: hhmm.nullable().optional(),
  status: z.enum(["conducted", "penalty", "cancelled_by_teacher", "cancelled_by_student"]),
  topic: z.string().max(200).nullable().optional(),
});

export type CreateLessonInput = z.infer<typeof schema>;

export async function createLessonAction(
  input: CreateLessonInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Некорректные данные";
    return { ok: false, error: msg };
  }

  const { user } = await requireRole("teacher");
  const teacher = await findTeacherByUserId(user.id);
  if (!teacher) return { ok: false, error: "Профиль учителя не настроен" };

  // Б1/Б7: единый helper владения.
  try {
    await assertTeacherOwnsStudent(user.id, parsed.data.student_id);
  } catch {
    return { ok: false, error: "Этот ученик не в вашей группе" };
  }

  // Б5: запрещаем урок если ученик не active (бросил/закрыт/в архиве — баланс не должен уходить в минус).
  const studentRow = await sql<Array<{ status: string }>>`
    select status::text from students where id = ${parsed.data.student_id}
  `;
  if (studentRow.length === 0) return { ok: false, error: "Ученик не найден" };
  if (studentRow[0]!.status !== "active") {
    return {
      ok: false,
      error: `Нельзя записать урок: статус ученика «${studentRow[0]!.status}». Сначала верните в «Обучается».`,
    };
  }

  // Б3: защита от дубликата (двойной клик / повторная отправка).
  // Проверяем ровно тот же триплет (student, date, time) среди живых уроков.
  const dup = await sql<Array<{ id: string }>>`
    select id from lessons
    where student_id = ${parsed.data.student_id}
      and lesson_date = ${parsed.data.lesson_date}::date
      and coalesce(lesson_time::text, '') = ${parsed.data.lesson_time ?? ''}
      and deleted_at is null
    limit 1
  `;
  if (dup.length > 0) {
    return {
      ok: false,
      error: "Урок на эту дату и время для этого ученика уже записан",
    };
  }

  try {
    const id = await createLesson({
      student_id: parsed.data.student_id,
      teacher_id: teacher.id,
      lesson_date: parsed.data.lesson_date,
      lesson_time: parsed.data.lesson_time ?? null,
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

/** Быстрая запись урока с экрана «Сегодня». */
export async function quickLogLessonAction(input: CreateLessonInput) {
  return createLessonAction(input);
}
