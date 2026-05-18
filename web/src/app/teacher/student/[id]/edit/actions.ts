"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { normalizePhone } from "@/lib/auth/phone";
import { updateStudentProfile, assertTeacherOwnsStudent } from "@/lib/repos/students";

const schema = z.object({
  student_id: z.string().uuid(),
  full_name: z.string().trim().min(2).max(200),
  phone: z.string().trim().max(40).nullable().optional(),
  telegram_username: z.string().trim().max(40).nullable().optional(),
  telegram_phone: z.string().trim().max(40).nullable().optional(),
  whatsapp_phone: z.string().trim().max(40).nullable().optional(),
  is_charity: z.boolean(),
  charity_note: z.string().trim().max(200).nullable().optional(),
});

export async function updateStudentAction(
  input: z.infer<typeof schema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректные данные" };

  // Учитель тоже может редактировать — но только своего ученика.
  const { user } = await requireRole("teacher", "manager", "curator", "head", "admin");
  if (user.role === "teacher") {
    try {
      await assertTeacherOwnsStudent(user.id, parsed.data.student_id);
    } catch {
      return { ok: false, error: "Это не ваш ученик" };
    }
  }

  try {
    await updateStudentProfile({
      student_id: parsed.data.student_id,
      full_name: parsed.data.full_name,
      phone: parsed.data.phone ? normalizePhone(parsed.data.phone) : null,
      telegram_username: parsed.data.telegram_username?.trim().replace(/^@/, "") || null,
      telegram_phone: parsed.data.telegram_phone ? normalizePhone(parsed.data.telegram_phone) : null,
      whatsapp_phone: parsed.data.whatsapp_phone ? normalizePhone(parsed.data.whatsapp_phone) : null,
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
