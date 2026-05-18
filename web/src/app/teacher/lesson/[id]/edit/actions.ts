"use server";

import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { sql } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { assertTeacherOwnsLesson } from "@/lib/repos/students";
import { findTeacherByUserId } from "@/lib/repos/teachers";

const DEDUCT: string[] = ["conducted", "penalty"];

/**
 * Проверка: этот ли урок — самый последний урок учителя С ЭТИМ УЧЕНИКОМ.
 * Учитель может редактировать/удалять только последний урок с каждым учеником
 * — это защита от правок «давних» уроков, влияющих на ФОТ и баланс, но
 * позволяет учителю поправить опечатку в свежем уроке у любого из своих учеников.
 */
async function assertIsLastLessonWithStudent(
  txOrSql: typeof sql,
  teacherId: string,
  studentId: string,
  lessonId: string,
): Promise<void> {
  const rows = await txOrSql<Array<{ id: string }>>`
    select id from lessons
    where teacher_id = ${teacherId}
      and student_id = ${studentId}
      and deleted_at is null
    order by created_at desc, id desc
    limit 1
  `;
  if (rows.length === 0 || rows[0]!.id !== lessonId) {
    throw new Error("not_last_lesson");
  }
}

const editSchema = z.object({
  lesson_id: z.string().uuid(),
  lesson_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((s) => {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      return new Date(s + "T00:00:00") <= today;
    }, "Дата урока в будущем"),
  lesson_time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  status: z.enum([
    "conducted",
    "penalty",
    "cancelled_by_student",
    "cancelled_by_teacher",
  ]),
  topic: z.string().trim().max(500).nullable(),
  notes: z.string().trim().max(2000).nullable(),
});

/** Корректное обновление: учитываем разницу в списании баланса при смене статуса.
 *  Учитель может редактировать только СВОЙ ПОСЛЕДНИЙ созданный урок.
 *  Куратор+ — любой. */
export async function editLessonAction(
  input: z.infer<typeof editSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Некорректные данные" };
  }
  const { user } = await requireRole("teacher", "manager", "curator", "head", "admin");

  try {
    await sql.begin(async (tx) => {
      const old = await tx<
        Array<{ student_id: string; status: string; lesson_date: Date; teacher_id: string }>
      >`
        select student_id, status::text, lesson_date, teacher_id
        from lessons where id = ${parsed.data.lesson_id} and deleted_at is null
      `;
      if (old.length === 0) throw new Error("not_found");
      const oldRow = old[0]!;

      if (user.role === "teacher") {
        await assertTeacherOwnsLesson(user.id, parsed.data.lesson_id);
        const teacher = await findTeacherByUserId(user.id);
        if (!teacher) throw new Error("not_owner");
        await assertIsLastLessonWithStudent(
          tx as typeof sql,
          teacher.id,
          oldRow.student_id,
          parsed.data.lesson_id,
        );
      }

      // Корректировка баланса: если статус был списывающий, а стал нет — вернуть; и наоборот
      const wasDeduct = DEDUCT.includes(oldRow.status);
      const willDeduct = DEDUCT.includes(parsed.data.status);
      let delta = 0;
      if (wasDeduct && !willDeduct) delta = +1;
      if (!wasDeduct && willDeduct) delta = -1;
      if (delta !== 0) {
        await tx`
          update students
          set balance = balance + ${delta}, updated_at = now()
          where id = ${oldRow.student_id}
        `;
      }

      await tx`
        update lessons
        set lesson_date = ${parsed.data.lesson_date},
            lesson_time = ${parsed.data.lesson_time ?? null},
            status      = ${parsed.data.status}::lesson_status,
            topic       = ${parsed.data.topic ?? null},
            notes       = ${parsed.data.notes ?? null},
            updated_at  = now()
        where id = ${parsed.data.lesson_id}
      `;

      await tx`
        insert into audit_log (actor_id, action, entity_type, entity_id, diff)
        values (${user.id}, 'lesson.edit', 'lesson', ${parsed.data.lesson_id},
                ${sql.json({ status_from: oldRow.status, status_to: parsed.data.status, delta })})
      `;
    });
    revalidatePath("/teacher");
    revalidateTag("salary");
    return { ok: true };
  } catch (err) {
    if (err instanceof Error && err.message === "not_last_lesson") {
      return {
        ok: false,
        error: "Можно редактировать только последний добавленный урок. Если нужна правка более раннего — обратитесь к куратору.",
      };
    }
    if (err instanceof Error && err.message === "not_owner") {
      return { ok: false, error: "Нет прав на этот урок" };
    }
    console.error("editLesson failed:", err);
    return { ok: false, error: "Не удалось сохранить" };
  }
}

const deleteSchema = z.object({ lesson_id: z.string().uuid() });

export async function deleteLessonAction(
  input: z.infer<typeof deleteSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректные данные" };
  // Учитель тоже может удалить — но только свой последний урок (см. ниже).
  const { user } = await requireRole("teacher", "curator", "head", "admin");

  try {
    await sql.begin(async (tx) => {
      const rows = await tx<
        Array<{ student_id: string; status: string; teacher_id: string }>
      >`select student_id, status::text, teacher_id from lessons where id = ${parsed.data.lesson_id} and deleted_at is null`;
      if (rows.length === 0) throw new Error("not_found");
      const row = rows[0]!;

      if (user.role === "teacher") {
        await assertTeacherOwnsLesson(user.id, parsed.data.lesson_id);
        const teacher = await findTeacherByUserId(user.id);
        if (!teacher) throw new Error("not_owner");
        await assertIsLastLessonWithStudent(
          tx as typeof sql,
          teacher.id,
          row.student_id,
          parsed.data.lesson_id,
        );
      }

      // Если урок списывал баланс — возвращаем 1
      if (DEDUCT.includes(row.status)) {
        await tx`update students set balance = balance + 1, updated_at = now() where id = ${row.student_id}`;
      }
      await tx`update lessons set deleted_at = now() where id = ${parsed.data.lesson_id}`;
      await tx`
        insert into audit_log (actor_id, action, entity_type, entity_id, diff)
        values (${user.id}, 'lesson.delete', 'lesson', ${parsed.data.lesson_id},
                ${sql.json({ status: row.status })})
      `;
    });
    revalidatePath("/teacher");
    revalidateTag("salary");
    return { ok: true };
  } catch (err) {
    if (err instanceof Error && err.message === "not_last_lesson") {
      return {
        ok: false,
        error: "Можно удалить только последний добавленный урок. Если нужно удалить ранний — обратитесь к куратору.",
      };
    }
    if (err instanceof Error && err.message === "not_owner") {
      return { ok: false, error: "Нет прав на этот урок" };
    }
    console.error("deleteLesson failed:", err);
    return { ok: false, error: "Не удалось удалить" };
  }
}
