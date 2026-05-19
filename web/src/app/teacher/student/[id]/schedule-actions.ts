"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { findTeacherByUserId } from "@/lib/repos/teachers";
import { assertTeacherOwnsStudent } from "@/lib/repos/students";
import {
  createSchedule,
  deactivateSchedule,
  replaceStudentSchedule,
} from "@/lib/repos/schedules";
import { sql } from "@/lib/db";

const hhmm = z.string().regex(/^\d{2}:\d{2}$/);

const saveSchema = z.object({
  student_id: z.string().uuid(),
  weekday: z.number().int().min(1).max(7),
  time_at: hhmm,
  duration_min: z.number().int().min(10).max(240).default(30),
  note: z.string().max(200).nullable().optional(),
});

export async function saveScheduleAction(
  input: z.infer<typeof saveSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректные данные" };

  const { user } = await requireRole("teacher", "manager", "curator", "admin");

  try {
    if (user.role === "teacher") {
      await assertTeacherOwnsStudent(user.id, parsed.data.student_id);
    }
    const id = await createSchedule(parsed.data);
    return { ok: true, id };
  } catch (err) {
    console.error("saveSchedule failed:", err);
    return { ok: false, error: "Не удалось сохранить слот" };
  }
}

const removeSchema = z.object({ id: z.string().uuid() });

export async function removeScheduleAction(
  input: z.infer<typeof removeSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректные данные" };

  const { user } = await requireRole("teacher", "manager", "curator", "admin");

  try {
    if (user.role === "teacher") {
      // учитель может удалять только слоты своих учеников
      const teacher = await findTeacherByUserId(user.id);
      if (!teacher) return { ok: false, error: "нет профиля учителя" };
      const owns = await sql<Array<{ id: string }>>`
        select sc.id from student_schedules sc
        join students s on s.id = sc.student_id
        where sc.id = ${parsed.data.id} and s.teacher_id = ${teacher.id}
      `;
      if (owns.length === 0) return { ok: false, error: "не ваш ученик" };
    }
    await deactivateSchedule(parsed.data.id);
    return { ok: true };
  } catch (err) {
    console.error("removeSchedule failed:", err);
    return { ok: false, error: "Не удалось удалить" };
  }
}

const replaceSchema = z.object({
  student_id: z.string().uuid(),
  slots: z
    .array(
      z.object({
        weekday: z.number().int().min(1).max(7),
        time_at: hhmm,
      }),
    )
    .max(14),
});

export async function replaceStudentScheduleAction(
  input: z.infer<typeof replaceSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = replaceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректные данные" };

  const { user } = await requireRole("teacher", "manager", "curator", "head", "admin");

  try {
    if (user.role === "teacher") {
      await assertTeacherOwnsStudent(user.id, parsed.data.student_id);
    }
    await replaceStudentSchedule(parsed.data.student_id, parsed.data.slots);
    await sql`
      insert into audit_log (actor_id, action, entity_type, entity_id, diff)
      values (${user.id}, 'student.schedule_replace', 'student', ${parsed.data.student_id},
              ${sql.json({ slot_count: parsed.data.slots.length })})
    `;
    revalidatePath(`/teacher/student/${parsed.data.student_id}`);
    return { ok: true };
  } catch (err) {
    console.error("replaceSchedule failed:", err);
    return { ok: false, error: "Не удалось сохранить расписание" };
  }
}
