"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { updateStudentProfile } from "@/lib/repos/students";

const schema = z.object({
  student_id: z.string().uuid(),
  full_name: z.string().trim().min(2).max(200),
  phone: z.string().trim().max(40).nullable().optional(),
  telegram_username: z.string().trim().max(40).nullable().optional(),
  is_charity: z.boolean(),
  charity_note: z.string().trim().max(200).nullable().optional(),
});

export async function updateStudentAction(
  input: z.infer<typeof schema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректные данные" };
  const { user } = await requireRole("manager", "curator", "head", "admin");
  try {
    await updateStudentProfile({
      student_id: parsed.data.student_id,
      full_name: parsed.data.full_name,
      phone: parsed.data.phone?.trim() || null,
      telegram_username: parsed.data.telegram_username?.trim().replace(/^@/, "") || null,
      is_charity: parsed.data.is_charity,
      charity_note: parsed.data.charity_note?.trim() || null,
      actor_id: user.id,
    });
    revalidatePath(`/teacher/student/${parsed.data.student_id}`);
    return { ok: true };
  } catch (err) {
    console.error("updateStudent failed:", err);
    return { ok: false, error: "Не удалось сохранить" };
  }
}
