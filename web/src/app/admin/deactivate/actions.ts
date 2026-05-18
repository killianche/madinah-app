"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { setUserActive } from "@/lib/repos/users";

const schema = z.object({
  user_id: z.string().uuid(),
  active: z.boolean(),
});

export async function toggleUserActiveAction(
  input: z.infer<typeof schema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректные данные" };
  const { user } = await requireRole("admin");
  if (user.id === parsed.data.user_id && !parsed.data.active) {
    return { ok: false, error: "Нельзя деактивировать самого себя" };
  }
  try {
    await setUserActive(parsed.data.user_id, parsed.data.active, user.id);
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    console.error("toggleUserActive failed:", err);
    return { ok: false, error: "Не удалось изменить статус" };
  }
}
