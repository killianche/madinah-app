"use server";

import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { findTeacherByUserId } from "@/lib/repos/teachers";
import { createLesson } from "@/lib/repos/lessons";
import { sql } from "@/lib/db";

const schema = z.object({
  student_id: z.string().uuid(),
  lesson_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["conducted", "penalty", "cancelled_by_teacher", "cancelled_by_student"]),
  topic: z.string().max(200).nullable().optional(),
});

export async function createLessonAction(
  input: z.infer<typeof schema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Некорректные данные" };
  }

  const { user } = await requireRole("teacher");
  const teacher = await findTeacherByUserId(user.id);
  if (!teacher) return { ok: false, error: "Профиль учителя не настроен" };

  // Убедимся, что ученик действительно привязан к этому учителю
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
