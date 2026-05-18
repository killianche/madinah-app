"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { resetUserPassword } from "@/lib/repos/users";

const schema = z.object({
  user_id: z.string().uuid(),
  password: z.string().min(6).max(60),
});

export async function resetPasswordAction(
  input: z.infer<typeof schema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Пароль минимум 6 символов" };
  const { user } = await requireRole("curator", "head", "admin");
  await resetUserPassword(parsed.data.user_id, parsed.data.password, user.id);
  revalidatePath("/manager/credentials");
  return { ok: true };
}
