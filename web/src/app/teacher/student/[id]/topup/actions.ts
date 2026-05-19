"use server";

import { z } from "zod";
import { requireAuth } from "@/lib/auth/session";
import { createTopup } from "@/lib/repos/topups";
import { assertTeacherOwnsStudent } from "@/lib/repos/students";

const schema = z.object({
  student_id: z.string().uuid(),
  lessons_added: z.number().int().refine((n) => n !== 0, "Нельзя 0"),
  reason: z.string().max(200).nullable().optional(),
});

export async function topupAction(
  input: z.infer<typeof schema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректные данные" };

  const { user } = await requireAuth();
  if (!["teacher", "manager", "curator", "head", "director", "admin"].includes(user.role)) {
    return { ok: false, error: "Недостаточно прав" };
  }

  // Учитель — только свой ученик.
  if (user.role === "teacher") {
    try {
      await assertTeacherOwnsStudent(user.id, parsed.data.student_id);
    } catch {
      return { ok: false, error: "Это не ваш ученик" };
    }
  }

  try {
    await createTopup({
      student_id: parsed.data.student_id,
      lessons_added: parsed.data.lessons_added,
      reason: parsed.data.reason ?? null,
      added_by: user.id,
    });
    return { ok: true };
  } catch (err) {
    console.error("createTopup failed:", err);
    return { ok: false, error: "Не удалось сохранить пополнение" };
  }
}
