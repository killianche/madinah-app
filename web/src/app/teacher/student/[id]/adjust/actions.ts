"use server";

import { z } from "zod";
import { requireAuth } from "@/lib/auth/session";
import { createTopup } from "@/lib/repos/topups";

const schema = z.object({
  student_id: z.string().uuid(),
  delta: z.number().int().refine((n) => n !== 0, "Нельзя 0"),
  reason: z.string().min(1, "Укажите причину").max(200),
});

export async function adjustAction(
  input: z.infer<typeof schema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  const { user } = await requireAuth();
  if (!["manager", "curator", "head", "admin"].includes(user.role)) {
    return { ok: false, error: "Недостаточно прав" };
  }


  try {
    await createTopup({
      student_id: parsed.data.student_id,
      lessons_added: parsed.data.delta,
      reason: parsed.data.reason,
      added_by: user.id,
    });
    return { ok: true };
  } catch (err) {
    console.error("adjustAction failed:", err);
    return { ok: false, error: "Не удалось сохранить коррекцию" };
  }
}
