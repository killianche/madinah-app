"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { sql } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, setSessionCookie } from "@/lib/auth/session";

const schema = z.object({
  identifier: z.string().trim().min(1, "Введите телефон или email"),
  password: z.string().min(1, "Введите пароль"),
});

export async function loginAction(
  input: z.infer<typeof schema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Некорректный ввод" };
  }
  const { identifier, password } = parsed.data;

  // ищем по email или телефону
  const rows = await sql<Array<{ id: string; password_hash: string | null; is_active: boolean }>>`
    select id, password_hash, is_active from users
    where (email = ${identifier.toLowerCase()} or phone = ${identifier})
    limit 1
  `;
  const user = rows[0];

  if (!user || !user.is_active || !user.password_hash) {
    return { ok: false, error: "Неверные данные для входа" };
  }

  const ok = await verifyPassword(user.password_hash, password);
  if (!ok) {
    return { ok: false, error: "Неверные данные для входа" };
  }

  const h = await headers();
  const ua = h.get("user-agent") ?? undefined;
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;

  const { token, session } = await createSession(user.id, { ip, ua });
  await setSessionCookie(token, session.expires_at);

  await sql`update users set last_login_at = now() where id = ${user.id}`;

  return { ok: true };
}
