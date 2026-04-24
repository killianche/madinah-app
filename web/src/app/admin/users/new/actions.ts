"use server";

import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createUser } from "@/lib/repos/users";
import { generateTempPassword } from "@/lib/auth/password";

const schema = z.object({
  full_name: z.string().trim().min(2),
  role: z.enum(["admin", "director", "manager", "curator", "head", "teacher"]),
  phone: z.string().trim().nullable().optional(),
  email: z.string().trim().email().nullable().optional().or(z.literal("").transform(() => null)),
  teacher_id: z.string().uuid().nullable().optional(),
});

export async function createUserAction(
  input: z.infer<typeof schema>,
): Promise<
  | { ok: true; id: string; temp_password: string }
  | { ok: false; error: string }
> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректные данные" };

  const { user } = await requireRole("admin");
  const tempPwd = generateTempPassword();

  try {
    const id = await createUser({
      role: parsed.data.role,
      full_name: parsed.data.full_name,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      password: tempPwd,
      teacher_id: parsed.data.teacher_id || null,
      created_by: user.id,
    });
    return { ok: true, id, temp_password: tempPwd };
  } catch (err: unknown) {
    console.error("createUser failed:", err);
    const msg = err instanceof Error ? err.message : "неизвестная ошибка";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { ok: false, error: "Пользователь с таким телефоном/email уже существует" };
    }
    return { ok: false, error: "Не удалось создать сотрудника" };
  }
}
