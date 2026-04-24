"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { changeStudentTeacher } from "@/lib/repos/students";

const schema = z.object({
  student_id: z.string().uuid(),
  new_teacher_id: z.string().uuid(),
  reason: z.string().trim().max(500).nullable().optional(),
});

export async function changeTeacherAction(
  input: z.infer<typeof schema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Некорректные данные" };
  }
  const { user } = await requireRole("manager", "curator", "admin");

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
