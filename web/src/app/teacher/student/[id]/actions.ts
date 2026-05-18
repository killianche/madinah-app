"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth, requireRole } from "@/lib/auth/session";
import {
  changeStudentTeacher,
  changeStudentStatus,
  findStudentById,
} from "@/lib/repos/students";
import { findTeacherByUserId } from "@/lib/repos/teachers";

const teacherSchema = z.object({
  student_id: z.string().uuid(),
  new_teacher_id: z.string().uuid(),
  reason: z.string().trim().max(500).nullable().optional(),
});

export async function changeTeacherAction(
  input: z.infer<typeof teacherSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = teacherSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Некорректные данные" };
  }
  const { user } = await requireRole("manager", "curator", "head", "admin");

  try {
    await changeStudentTeacher({
      student_id: parsed.data.student_id,
      new_teacher_id: parsed.data.new_teacher_id,
      reason: parsed.data.reason || null,
      actor_id: user.id,
    });
    revalidatePath(`/teacher/student/${parsed.data.student_id}`);
    return { ok: true };
  } catch (err) {
    console.error("changeTeacher failed:", err);
    return { ok: false, error: "Не удалось сменить учителя" };
  }
}

const statusSchema = z.object({
  student_id: z.string().uuid(),
  new_status: z.enum(["active", "paused", "graduated", "dropped", "archived"]),
  reason: z.string().trim().max(500).nullable().optional(),
});

export async function changeStatusAction(
  input: z.infer<typeof statusSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Некорректные данные" };
  }
  const auth = await requireAuth();
  const role = auth.user.role;
  const privileged = ["manager", "curator", "head", "admin"].includes(role);

  // Учитель может менять статус только у своего ученика
  if (!privileged) {
    if (role !== "teacher") {
      return { ok: false, error: "Нет прав" };
    }
    const student = await findStudentById(parsed.data.student_id);
    if (!student) return { ok: false, error: "Ученик не найден" };
    const teacher = await findTeacherByUserId(auth.user.id);
    if (!teacher || student.teacher_id !== teacher.id) {
      return { ok: false, error: "Ученик не в вашей группе" };
    }
  }

  try {
    await changeStudentStatus({
      student_id: parsed.data.student_id,
      new_status: parsed.data.new_status,
      reason: parsed.data.reason || null,
      actor_id: auth.user.id,
    });
    revalidatePath(`/teacher/student/${parsed.data.student_id}`);
    return { ok: true };
  } catch (err) {
    console.error("changeStatus failed:", err);
    return { ok: false, error: "Не удалось сменить статус" };
  }
}
