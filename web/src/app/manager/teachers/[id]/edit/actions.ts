"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";

const schema = z.object({
  teacher_id: z.string().uuid(),
  full_name: z.string().trim().min(2),
  phone: z.string().trim().nullable(),
  login: z.string().trim().min(2).max(40).nullable(),
});

export async function editTeacherAction(
  input: z.infer<typeof schema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Некорректные данные" };
  }
  const { user } = await requireRole("curator", "head", "admin");

  try {
    await sql.begin(async (tx) => {
      await tx`
        update teachers
        set full_name = ${parsed.data.full_name},
            phone     = ${parsed.data.phone ?? null},
            updated_at = now()
        where id = ${parsed.data.teacher_id}
      `;
      // Также обновляем связанного user-а
      await tx`
        update users
        set full_name = ${parsed.data.full_name},
            phone     = ${parsed.data.phone ?? null},
            login     = ${parsed.data.login ?? null},
            updated_at = now()
        where id = (select user_id from teachers where id = ${parsed.data.teacher_id})
      `;
      await tx`
        insert into audit_log (actor_id, action, entity_type, entity_id, diff)
        values (${user.id}, 'teacher.edit', 'teacher', ${parsed.data.teacher_id},
                ${sql.json({ full_name: parsed.data.full_name, phone: parsed.data.phone, login: parsed.data.login })})
      `;
    });
    revalidatePath(`/manager/teachers/${parsed.data.teacher_id}`);
    revalidatePath("/manager/teachers");
    revalidatePath("/manager/credentials");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { ok: false, error: "Логин или телефон уже заняты" };
    }
    console.error("editTeacher failed:", err);
    return { ok: false, error: "Не удалось сохранить" };
  }
}
