"use server";

import { z } from "zod";
import { sql } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";

const schema = z.object({
  full_name: z.string().trim().min(2),
  phone: z.string().trim().nullable().optional(),
  telegram_username: z.string().trim().nullable().optional(),
  teacher_id: z.string().uuid().nullable().optional(),
  initial_balance: z.number().int(),
  is_charity: z.boolean(),
});

export async function createStudentAction(
  input: z.infer<typeof schema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректные данные" };

  const { user } = await requireRole("manager", "curator", "director", "admin");

  try {
    const id = await sql.begin(async (tx) => {
      const rows = await tx<Array<{ id: string }>>`
        insert into students (full_name, phone, telegram_username, teacher_id, balance, is_charity, charity_since, enrolled_at)
        values (${parsed.data.full_name}, ${parsed.data.phone ?? null},
                ${parsed.data.telegram_username ?? null}, ${parsed.data.teacher_id ?? null},
                ${parsed.data.initial_balance},
                ${parsed.data.is_charity},
                ${parsed.data.is_charity ? new Date() : null},
                ${new Date()})
        returning id
      `;
      const studentId = rows[0]!.id;
      if (parsed.data.initial_balance !== 0) {
        await tx`
          insert into balance_topups (student_id, lessons_added, reason, added_by)
          values (${studentId}, ${parsed.data.initial_balance}, 'Стартовый баланс', ${user.id})
        `;
      }
      await tx`
        insert into audit_log (actor_id, action, entity_type, entity_id, diff)
        values (${user.id}, 'student.create', 'student', ${studentId}, ${sql.json({
          is_charity: parsed.data.is_charity,
          initial_balance: parsed.data.initial_balance,
        })})
      `;
      return studentId;
    });
    return { ok: true, id };
  } catch (err) {
    console.error("createStudent failed:", err);
    return { ok: false, error: "Не удалось создать ученика" };
  }
}
