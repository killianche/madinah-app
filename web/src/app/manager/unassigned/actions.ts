"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { assignTeacherToStudent } from "@/lib/repos/students";

const schema = z.object({
  student_id: z.string().uuid(),
  teacher_id: z.string().uuid(),
});

export async function assignTeacherAction(
  input: z.infer<typeof schema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректные данные" };

  const { user } = await requireRole("curator", "head", "manager", "admin");
  const ok = await assignTeacherToStudent(parsed.data.student_id, parsed.data.teacher_id, user.id);
  if (!ok) return { ok: false, error: "Ученик не найден" };

  revalidatePath("/manager/unassigned");
  revalidatePath("/manager");
  return { ok: true };
}
