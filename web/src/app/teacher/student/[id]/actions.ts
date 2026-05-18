"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuth, requireRole } from "@/lib/auth/session";
import {
  changeStudentTeacher,
  changeStudentStatus,
  claimStudent,
  deleteStudent,
  findStudentById,
} from "@/lib/repos/students";
import { findTeacherById, findTeacherByUserId } from "@/lib/repos/teachers";

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

  // Д3: не назначать архивированного/уволенного/на паузе учителя.
  const targetTeacher = await findTeacherById(parsed.data.new_teacher_id);
  if (!targetTeacher) return { ok: false, error: "Учитель не найден" };
  if (targetTeacher.status !== "active") {
    return {
      ok: false,
      error: `Учитель в статусе «${targetTeacher.status}» — сначала верните в «active».`,
    };
  }

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
  new_status: z.enum(["active", "paused", "graduated", "dropped", "closed", "archived"]),
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
    if (err instanceof Error && err.message) {
      // Вернём policy-ошибку напрямую (например «возврат требует комментария»).
      const isPolicy = err.message.startsWith("Возврат") || err.message.startsWith("Это уже");
      if (isPolicy) return { ok: false, error: err.message };
    }
    console.error("changeStatus failed:", err);
    return { ok: false, error: "Не удалось сменить статус" };
  }
}

export async function deleteStudentAction(
  studentId: string,
): Promise<{ ok: false; error: string }> {
  const { user } = await requireRole("head", "admin");
  try {
    await deleteStudent(studentId, user.id);
  } catch (err) {
    if (err instanceof Error && err.message === "not_found") {
      return { ok: false, error: "Ученик не найден" };
    }
    console.error("deleteStudent failed:", err);
    return { ok: false, error: "Не удалось удалить ученика" };
  }
  revalidatePath("/manager");
  redirect("/manager");
}

/**
 * Менеджер/куратор/head/admin делает себя создателем ученика — чтобы попадал в «Мои».
 */
export async function claimStudentAction(
  studentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { user } = await requireRole("manager", "curator", "head", "admin");
  try {
    await claimStudent(studentId, user.id);
    revalidatePath(`/teacher/student/${studentId}`);
    revalidatePath("/manager");
    return { ok: true };
  } catch (err) {
    if (err instanceof Error && err.message === "not_found") {
      return { ok: false, error: "Ученик не найден" };
    }
    console.error("claimStudent failed:", err);
    return { ok: false, error: "Не удалось привязать" };
  }
}
