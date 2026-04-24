"use server";

import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { findTeacherByUserId } from "@/lib/repos/teachers";
import { createSchedule, deactivateSchedule } from "@/lib/repos/schedules";
import { sql } from "@/lib/db";

const hhmm = z.string().regex(/^\d{2}:\d{2}$/);

const saveSchema = z.object({
  student_id: z.string().uuid(),
  weekday: z.number().int().min(1).max(7),
  time_at: hhmm,
  duration_min: z.number().int().min(10).max(240).default(60),
  note: z.string().max(200).nullable().optional(),
});

async function assertTeacherOwnsStudent(userId: string, studentId: string) {
  const teacher = await findTeacherByUserId(userId);
  if (!teacher) throw new Error("no teacher profile");
  const rows = await sql<Array<{ id: string }>>`
    select id from students where id = ${studentId} and teacher_id = ${teacher.id}
  `;
  if (rows.length === 0) throw new Error("not your student");
  return teacher;
}

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
