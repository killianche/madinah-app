"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { createUser, setUserActive } from "@/lib/repos/users";

const createSchema = z.object({
  full_name: z.string().trim().min(2),
  role: z.enum(["admin", "manager", "curator", "head", "teacher"]),
  login: z.string().trim().min(2, "Логин минимум 2 символа").max(40),
  phone: z.string().trim().nullable().optional(),
  password: z.string().min(6, "Пароль минимум 6 символов").max(60),
  teacher_id: z.string().uuid().nullable().optional(),
});

export async function createStaffAction(
  input: z.infer<typeof createSchema>,
): Promise<
  | { ok: true; id: string; temp_password: string }
  | { ok: false; error: string }
> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "Некорректные данные";
    return { ok: false, error: msg };
  }
  const { user } = await requireRole("head", "admin");

  // Руководитель не может создавать админов.
  if (user.role === "head" && parsed.data.role === "admin") {
    return { ok: false, error: "Руководитель не может создавать администраторов" };
  }

  try {
    const id = await createUser({
      role: parsed.data.role,
      full_name: parsed.data.full_name,
      login: parsed.data.login,
      phone: parsed.data.phone || null,
      email: null,
      password: parsed.data.password,
      teacher_id: parsed.data.teacher_id || null,
      created_by: user.id,
    });
    revalidatePath("/manager/staff");
    return { ok: true, id, temp_password: parsed.data.password };
  } catch (err: unknown) {
    console.error("createStaff failed:", err);
    const msg = err instanceof Error ? err.message : "неизвестная ошибка";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { ok: false, error: "Логин или телефон уже заняты" };
    }
    return { ok: false, error: "Не удалось создать сотрудника" };
  }
}

const toggleSchema = z.object({
  user_id: z.string().uuid(),
  active: z.boolean(),
});

export async function toggleStaffActiveAction(
  input: z.infer<typeof toggleSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректные данные" };
  const { user } = await requireRole("head", "admin");
  if (user.id === parsed.data.user_id && !parsed.data.active) {
    return { ok: false, error: "Нельзя деактивировать самого себя" };
  }

  // Руководитель не может управлять админами.
  if (user.role === "head") {
    const target = await sql<Array<{ role: string }>>`
      select role::text from users where id = ${parsed.data.user_id}
    `;
    if (target.length === 0) return { ok: false, error: "Пользователь не найден" };
    if (target[0]!.role === "admin") {
      return { ok: false, error: "Нет прав на администратора" };
    }
  }

  try {
    await setUserActive(parsed.data.user_id, parsed.data.active, user.id);
    revalidatePath("/manager/staff");
    return { ok: true };
  } catch (err) {
    console.error("toggleStaffActive failed:", err);
    return { ok: false, error: "Не удалось изменить статус" };
  }
}
